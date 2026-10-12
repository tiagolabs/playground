import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { kubeconfig, localStateDirectory } from '../../scripts/paths.mjs';
import { atomicJson, components, stateDirectory, validateCandidateId, verifyCandidate } from './candidate.mjs';

export function selectCandidate(history, requested) {
  if (requested === 'rollback') {
    const target = history.pending ? history.current : history.previous;
    if (!target) throw new Error('No previous successful candidate is available for rollback');
    return target.candidateId;
  }
  validateCandidateId(requested);
  if (history.pending && history.current && history.pending.candidateId !== requested) throw new Error('An unfinished deployment exists; retry that candidate or run deploy.sh rollback');
  return requested;
}

export function successfulDeployment(history, candidate) {
  const current = { candidateId: candidate.candidateId, metadataSha256: candidate.metadataSha256, deployedAt: new Date().toISOString() };
  return { version: 1, current, previous: history.current?.candidateId === candidate.candidateId ? history.previous || null : history.current || null, pending: null };
}

export function validateDeployment(resources, candidate) {
  const allowedKinds = new Set(['ServiceAccount', 'Deployment', 'Service', 'HTTPRoute', 'PeerAuthentication', 'AuthorizationPolicy']);
  if (!Array.isArray(resources) || resources.length === 0 || resources.some(resource => resource.metadata?.namespace !== 'lab-identity' || !allowedKinds.has(resource.kind))) throw new Error('Candidate resources must belong only to the Lab Identity application namespace');
  const deployments = resources.filter(resource => resource.kind === 'Deployment');
  if (deployments.length !== 3 || !['redis', ...components].every(name => deployments.some(resource => resource.metadata.name === name))) throw new Error('Candidate must contain exactly the three Lab Identity deployments');
  for (const component of components) {
    const deployment = deployments.find(resource => resource.metadata.name === component);
    const container = deployment.spec.template.spec.containers.find(entry => entry.name === component);
    if (deployment.spec.replicas !== 1 || container?.image !== candidate.images[component].reference || container.imagePullPolicy !== 'Never') throw new Error(`Candidate ${component} does not use its archived immutable image`);
  }
}

// kubectl create prints one JSON object per YAML document, rather than a List.
export function readKubernetesResources(output) {
  const text = output.toString('utf8');
  const objects = [];
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (start === -1) {
      if (/\s/.test(char)) continue;
      if (char !== '{') throw new Error('Invalid Kubernetes JSON output');
      start = index;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        const object = JSON.parse(text.slice(start, index + 1));
        objects.push(...(object.kind === 'List' ? object.items : [object]));
        start = -1;
      }
    }
  }
  if (start !== -1 || objects.length === 0) throw new Error('Incomplete Kubernetes JSON output');
  return objects;
}

export function validateRunningPods(pods, component, image, replicas) {
  const active = pods.filter(pod => !pod.metadata.deletionTimestamp);
  const digests = new Set([image.rootDigest, image.manifestDigest, image.configDigest]);
  if (active.length !== replicas || active.some(pod => {
    const configured = pod.spec.containers.find(container => container.name === component);
    const running = pod.status.containerStatuses?.find(container => container.name === component);
    return configured?.image !== image.reference || !running?.ready || !digests.has(running.imageID?.match(/sha256:[a-f0-9]{64}$/)?.[0]) || !pod.status.conditions?.some(condition => condition.type === 'Ready' && condition.status === 'True');
  })) throw new Error(`Running ${component} pods do not match the archived candidate`);
}

const kubectlArgs = ['--kubeconfig', kubeconfig, '--context', 'k3d-tiagolabs-local', '--request-timeout=15s'];
function kube(args, options = {}) {
  return execFileSync('kubectl', [...kubectlArgs, ...args], { maxBuffer: 4 * 1024 * 1024, ...options });
}
function kubeJson(...args) { return JSON.parse(kube(args)); }

function verifyRuntime(candidate) {
  for (const component of components) {
    const deployment = kubeJson('-n', 'lab-identity', 'get', `deployment/${component}`, '-o', 'json');
    const image = candidate.images[component];
    if (deployment.spec.template.spec.containers.find(container => container.name === component)?.image !== image.reference || deployment.spec.replicas !== 1 || deployment.status.observedGeneration !== deployment.metadata.generation || deployment.status.updatedReplicas !== 1 || deployment.status.availableReplicas !== 1) throw new Error(`Deployment ${component} has drifted from the recorded candidate`);
    const pods = kubeJson('-n', 'lab-identity', 'get', 'pods', '-l', `app=${component}`, '-o', 'json').items;
    validateRunningPods(pods, component, image, 1);
    console.log(`Verified ${component} runtime digest against candidate ${candidate.candidateId}.`);
  }
}

function applyCredentials() {
  const directory = resolve(localStateDirectory, 'identity');
  const keys = ['LAB_IDENTITY_OIDC_CLIENT_SECRET', 'LAB_IDENTITY_ADMIN_CLIENT_SECRET', 'LAB_IDENTITY_STATE_SECRET', 'LAB_IDENTITY_CSRF_SECRET'];
  for (const key of keys) {
    if (!existsSync(resolve(directory, key)) || readFileSync(resolve(directory, key)).length === 0) throw new Error('Deploy shared identity first; required private credentials are missing');
  }
  const secret = kube(['-n', 'lab-identity', 'create', 'secret', 'generic', 'lab-identity-credentials', ...keys.map(key => `--from-file=${resolve(directory, key)}`), '--dry-run=client', '-o', 'yaml']);
  kube(['-n', 'lab-identity', 'apply', '-f', '-'], { input: secret, stdio: ['pipe', 'inherit', 'inherit'] });
}

async function deploy(requested) {
  const historyPath = resolve(stateDirectory, 'deployment.json');
  const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath)) : { version: 1, current: null, previous: null, pending: null };
  if (history.version !== 1) throw new Error('Unsupported deployment history');
  const id = selectCandidate(history, requested);
  const candidate = await verifyCandidate(id);
  for (const entry of [history.current, history.previous, history.pending].filter(entry => entry?.candidateId === id)) {
    if (entry.metadataSha256 !== candidate.metadataSha256) throw new Error('Recorded candidate metadata changed after deployment');
  }
  if (requested !== 'rollback' && !history.pending && history.current) {
    const current = await verifyCandidate(history.current.candidateId);
    if (current.metadataSha256 !== history.current.metadataSha256) throw new Error('Current candidate metadata changed');
    verifyRuntime(current);
  }
  const context = execFileSync('kubectl', ['--kubeconfig', kubeconfig, 'config', 'current-context'], { encoding: 'utf8' }).trim();
  if (context !== 'k3d-tiagolabs-local') throw new Error('Refusing to operate outside k3d-tiagolabs-local');
  const manifest = resolve(candidate.directory, 'deployment.yaml');
  const rendered = readKubernetesResources(kube(['-n', 'lab-identity', 'create', '--dry-run=client', '--validate=false', '-f', manifest, '-o', 'json']));
  validateDeployment(rendered, candidate);

  const k3d = process.env.K3D_BIN || 'k3d';
  const clusters = JSON.parse(execFileSync(k3d, ['cluster', 'list', '-o', 'json']));
  const cluster = clusters.find(entry => entry.name === 'tiagolabs-local');
  const nodes = cluster?.nodes.filter(node => ['server', 'agent'].includes(node.role));
  if (!nodes?.length || nodes.some(node => !/^k3d-tiagolabs-local-(server|agent)-\d+$/.test(node.name) || !node.State?.Running)) throw new Error('All TiagoLabs cluster nodes must be running before image import');
  execFileSync(k3d, ['image', 'import', '--mode', 'direct', '--cluster', 'tiagolabs-local', resolve(candidate.directory, 'images.tar')], { stdio: 'inherit' });
  for (const node of nodes) {
    for (const image of Object.values(candidate.images)) {
      execFileSync('docker', ['exec', node.name, 'ctr', '-n', 'k8s.io', 'images', 'tag', '--force', image.tag, image.reference], { stdio: 'inherit' });
    }
  }
  atomicJson(historyPath, { ...history, pending: { candidateId: id, metadataSha256: candidate.metadataSha256, startedAt: new Date().toISOString() } });
  applyCredentials();
  kube(['-n', 'lab-identity', 'apply', '-f', manifest], { stdio: 'inherit' });
  for (const component of ['redis', ...components]) {
    kube(['-n', 'lab-identity', 'rollout', 'status', `deployment/${component}`, '--timeout=300s'], { stdio: 'inherit' });
  }
  verifyRuntime(candidate);
  atomicJson(historyPath, successfulDeployment(history, candidate));
  console.log(`Successfully ${requested === 'rollback' ? 'rolled back to' : 'promoted'} candidate ${id}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: deploy.mjs CANDIDATE_ID|rollback');
    await deploy(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    console.error('After a rollout failure, retry the candidate or run infra/pipelines/lab-identity/deploy.sh rollback. Without a recorded success, build and select a corrected candidate.');
    process.exitCode = 1;
  }
}
