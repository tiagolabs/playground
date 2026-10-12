import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { clusterName, clusterState } from './cluster-state.mjs';
import { infraDirectory, localStateDirectory, kubeconfig } from './paths.mjs';

const execute = promisify(execFile);
const command = async (binary, args) => (await execute(binary, args, { timeout: 12000, maxBuffer: 2 * 1024 * 1024 })).stdout;
const action = process.argv[2];
if (!['status', 'check'].includes(action)) throw new Error('Usage: lab-health.mjs status|check');
const k3d = process.env.K3D_BIN || resolve(infraDirectory, '.local/tools/k3d');
const results = [];
async function probe(name, check) {
  try {
    results.push({ name, passed: true, detail: await check() });
  } catch (error) {
    // Command exceptions can contain raw output; report only the named check.
    results.push({ name, passed: false, detail: error.healthDetail || 'unavailable or not ready' });
  }
}
function requireHealth(condition, detail) {
  if (!condition) throw Object.assign(new Error(detail), { healthDetail: detail });
}
async function kube(...args) {
  return JSON.parse(await command('kubectl', ['--kubeconfig', kubeconfig, '--context', `k3d-${clusterName}`, '--request-timeout=10s', ...args, '-o', 'json']));
}
async function trustedHttp(url) {
  return command('curl', ['--fail', '--silent', '--show-error', '--noproxy', '*', '--max-time', '10', url]);
}

await Promise.all([
  probe('cluster', async () => {
    const state = clusterState(JSON.parse(await command(k3d, ['cluster', 'list', '-o', 'json'])));
    if (action === 'check') requireHealth(state.state === 'running', `${clusterName} is ${state.state}`);
    return `${clusterName}: ${state.state}${state.totalNodes ? ` (${state.runningNodes}/${state.totalNodes} containers)` : ''}`;
  }),
  probe('Jenkins controller', async () => {
    const state = (await command('docker', ['container', 'inspect', '--format', '{{.State.Status}}', 'tiagolabs-local-ci-jenkins-1'])).trim();
    if (action === 'check') {
      requireHealth(state === 'running', `controller is ${state}`);
      await trustedHttp('http://127.0.0.1:15180/login');
    }
    return state;
  }),
  probe('Jenkins agent', async () => {
    const state = (await command('systemctl', ['--user', 'show', 'tiagolabs-local-jenkins-agent.service', '--property=ActiveState', '--value'])).trim();
    if (action === 'check') {
      requireHealth(state === 'active', `agent service is ${state || 'not installed'}`);
      const settings = readFileSync(resolve(localStateDirectory, 'ci/jenkins/.env'), 'utf8');
      const password = settings.match(/^JENKINS_ADMIN_PASSWORD=(.+)$/m)?.[1];
      requireHealth(Boolean(password), 'private Jenkins settings are missing');
      const response = await fetch('http://127.0.0.1:15180/computer/wsl-local/api/json?tree=offline', {
        headers: { Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}` },
        signal: AbortSignal.timeout(10000),
      });
      requireHealth(response.ok && (await response.json()).offline === false, 'agent is disconnected from Jenkins');
    }
    return action === 'check' ? 'active and connected' : state;
  }),
]);

if (action === 'check') {
  await probe('kubeconfig', async () => {
    const context = (await command('kubectl', ['--kubeconfig', kubeconfig, 'config', 'current-context'])).trim();
    requireHealth(context === `k3d-${clusterName}`, 'kubeconfig selects a different cluster');
    return context;
  });
  if (results.find(result => result.name === 'kubeconfig').passed) {
    await Promise.all([
      probe('Kubernetes nodes', async () => {
        const nodes = (await kube('get', 'nodes')).items;
        requireHealth(nodes.length === 3 && nodes.every(node => node.status.conditions.some(condition => condition.type === 'Ready' && condition.status === 'True')), 'expected three Ready nodes');
        return '3/3 Ready';
      }),
      probe('HTTPS Gateway', async () => {
        const gateway = await kube('-n', 'gateway-system', 'get', 'gateway/tiagolabs-local');
        requireHealth(['Accepted', 'Programmed'].every(type => gateway.status.conditions?.some(condition => condition.type === type && condition.status === 'True' && condition.observedGeneration === gateway.metadata.generation)), 'Gateway is not accepted and programmed');
        return 'accepted and programmed';
      }),
      ...['identity', 'lab-identity'].map(namespace => probe(`${namespace} workloads`, async () => {
        const deployments = (await kube('-n', namespace, 'get', 'deployments')).items;
        requireHealth(deployments.length >= 3 && deployments.every(deployment => deployment.status.observedGeneration === deployment.metadata.generation && deployment.spec.replicas > 0 && deployment.status.readyReplicas === deployment.spec.replicas && deployment.status.updatedReplicas === deployment.spec.replicas), 'deployments are missing, outdated, or not ready');
        return `${deployments.length} deployments ready`;
      })),
      probe('Lab Identity HTTPS and DNS', async () => {
        await trustedHttp('https://identity.lab.test/');
        return 'reachable with OS certificate trust';
      }),
      probe('Keycloak HTTPS and issuer', async () => {
        const discovery = JSON.parse(await trustedHttp('https://auth.lab.test/realms/lab/.well-known/openid-configuration'));
        requireHealth(discovery.issuer === 'https://auth.lab.test/realms/lab', 'unexpected OIDC issuer');
        return discovery.issuer;
      }),
    ]);
  }
}
for (const result of results.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`${result.passed ? 'OK' : 'FAIL'} ${result.name}: ${result.detail}`);
}
if (action === 'check' && results.some(result => !result.passed)) process.exitCode = 1;
