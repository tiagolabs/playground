import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const e2eDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageLock = JSON.parse(await readFile(path.join(e2eDirectory, 'package-lock.json'), 'utf8'))
const playwrightVersion = packageLock.packages['node_modules/@playwright/test'].version
const playwrightImage = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`
const k6Image = 'grafana/k6:2.3.0'
const gatewayIp = execFileSync('docker', ['inspect','k3d-cluster-lab-serverlb','--format','{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'], {encoding:'utf8'}).trim()
if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(gatewayIp)) throw new Error('Missing cluster-lab gateway address')
const hostMappings = [
  '--add-host', `heroassociation.test:${gatewayIp}`,
  '--add-host', `auth.lab.test:${gatewayIp}`,
]

function run(command, args, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: environment })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${signal || `status ${code}`}`))
    })
  })
}

const sessionDirectory = await mkdtemp(path.join(tmpdir(), 'hero-association-k6-'))
try {
  const kubeconfig = process.env.LAB_KUBECONFIG || process.env.HERO_ASSOCIATION_K3D_KUBECONFIG || path.join(e2eDirectory, '../../../infra/.local/kubeconfig')
  const kubectlEnvironment = { ...process.env, KUBECONFIG: kubeconfig }
  const context = execFileSync('kubectl', ['config', 'current-context'], {
    env: kubectlEnvironment,
    encoding: 'utf8',
  }).trim()
  if (context !== 'k3d-cluster-lab') {
    throw new Error(`Expected the isolated k3d-cluster-lab context, got ${context}`)
  }
  const readyReplicas = Number(execFileSync('kubectl', [
    '-n', 'hero-association', 'get', 'deployment', 'bff', '-o', 'jsonpath={.status.readyReplicas}',
  ], { env: kubectlEnvironment, encoding: 'utf8' }))
  if (readyReplicas < 2) {
    throw new Error(`The k6 test requires at least two ready BFF Pods; found ${readyReplicas || 0}`)
  }
  console.log(`Testing ${readyReplicas} ready BFF Pods in ${context}.`)
  console.log('Target: market-order limit enforced solely by k3d Envoy. Core HTTP 400 only marks a forwarded invalid order.')
  const common = [
    'run', '--rm', '--init', '--network', 'k3d-cluster-lab',
    ...hostMappings,
    '--user', `${process.getuid()}:${process.getgid()}`,
  ]
  await run('docker', [
    ...common,
    '--ipc', 'host',
    '--volume', `${e2eDirectory}:/work:ro`,
    '--volume', `${sessionDirectory}:/session`,
    '--workdir', '/work',
    playwrightImage,
    'node', '/work/prepare-k6-session.mjs',
  ])
  await run('docker', [
    ...common,
    ...(process.env.HERO_ASSOCIATION_K6_NO_CONNECTION_REUSE === 'true'
      ? ['--env', 'HERO_ASSOCIATION_K6_NO_CONNECTION_REUSE=true'] : []),
    '--volume', `${e2eDirectory}:/work:ro`,
    '--volume', `${sessionDirectory}:/session:ro`,
    k6Image,
    'run', '/work/market-rate-limit.k6.js',
  ])
} finally {
  await rm(sessionDirectory, { recursive: true, force: true })
}
