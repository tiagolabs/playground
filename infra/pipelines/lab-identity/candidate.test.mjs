import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { candidateDirectory, validateCandidateId, verifyCandidate } from './candidate.mjs';
import { readKubernetesResources, selectCandidate, successfulDeployment, validateDeployment, validateRunningPods } from './deploy.mjs';
import { fileSha256, inspectImageArchive, sha256 } from '../shared/image-archive.mjs';
import { infraDirectory } from '../../scripts/paths.mjs';

async function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'identity-candidate-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const id = 'candidate-a';
  const directory = candidateDirectory(id, root);
  const content = resolve(root, 'oci');
  mkdirSync(resolve(content, 'blobs/sha256'), { recursive: true });
  mkdirSync(directory);
  function blob(value) {
    const bytes = Buffer.from(JSON.stringify(value));
    const digest = `sha256:${sha256(bytes)}`;
    writeFileSync(resolve(content, `blobs/sha256/${digest.slice(7)}`), bytes);
    return { digest, size: bytes.length };
  }
  const tags = {};
  const manifests = ['backend', 'frontend'].map(component => {
    tags[component] = `lab-identity-${component}:${id}`;
    const config = blob({ os: 'linux', architecture: 'amd64', config: { Labels: { component } } });
    const manifest = blob({ schemaVersion: 2, config, layers: [] });
    const index = blob({ schemaVersion: 2, manifests: [{ ...manifest, platform: { os: 'linux', architecture: 'amd64' } }] });
    return { ...index, annotations: { 'io.containerd.image.name': `docker.io/library/${tags[component]}` } };
  });
  writeFileSync(resolve(content, 'index.json'), JSON.stringify({ schemaVersion: 2, manifests }));
  execFileSync('tar', ['-cf', resolve(directory, 'images.tar'), '-C', content, 'index.json', 'blobs']);
  writeFileSync(resolve(directory, 'deployment.yaml'), 'captured configuration');
  const candidate = { version: 1, application: 'lab-identity', candidateId: id, validation: 'passed', validatedAt: new Date().toISOString(),
    sourceDigest: sha256('older worktree'), archiveSha256: await fileSha256(resolve(directory, 'images.tar')),
    deploymentSha256: sha256('captured configuration'), images: inspectImageArchive(resolve(directory, 'images.tar'), tags) };
  writeFileSync(resolve(directory, 'candidate.json'), JSON.stringify(candidate));
  return { root, id, directory, candidate };
}

test('candidate IDs reject path traversal and shell input; deployment requires selection', () => {
  for (const id of ['', 'rollback', '../other', '/tmp/other', 'a;command', 'a$(command)', 'A', 'x'.repeat(101), undefined]) assert.throws(() => validateCandidateId(id));
  const result = spawnSync('bash', [resolve(infraDirectory, 'pipelines/lab-identity/deploy.sh')]);
  assert.equal(result.status, 2);
});

test('an archived passing candidate remains valid independently of the current worktree and tags', async t => {
  const { root, id, candidate } = await fixture(t);
  const verified = await verifyCandidate(id, root);
  assert.deepEqual(verified.images, candidate.images);
  assert.match(verified.images.backend.reference, /@sha256:[a-f0-9]{64}$/);
});

test('image archive corruption is rejected before promotion', async t => {
  const { root, id, directory } = await fixture(t);
  writeFileSync(resolve(directory, 'images.tar'), 'modified archive');
  await assert.rejects(verifyCandidate(id, root), /archive checksum mismatch/);
});

test('configuration tampering and image metadata substitution are rejected', async t => {
  const { root, id, directory, candidate } = await fixture(t);
  writeFileSync(resolve(directory, 'deployment.yaml'), 'modified configuration');
  await assert.rejects(verifyCandidate(id, root), /manifest checksum mismatch/);
  writeFileSync(resolve(directory, 'deployment.yaml'), 'captured configuration');
  candidate.images.backend.reference = 'docker.io/library/other@sha256:' + 'a'.repeat(64);
  writeFileSync(resolve(directory, 'candidate.json'), JSON.stringify(candidate));
  await assert.rejects(verifyCandidate(id, root), /does not match its archive/);
});

test('failed or incomplete validation cannot be promoted', async t => {
  const { root, id, directory, candidate } = await fixture(t);
  candidate.validation = 'pending';
  writeFileSync(resolve(directory, 'candidate.json'), JSON.stringify(candidate));
  await assert.rejects(verifyCandidate(id, root), /passing build record/);
});

test('rollback selects the previous success or restores the current success after a failed rollout', () => {
  const history = { current: { candidateId: 'b' }, previous: { candidateId: 'a' }, pending: null };
  assert.equal(selectCandidate(history, 'rollback'), 'a');
  assert.equal(selectCandidate({ ...history, pending: { candidateId: 'c' } }, 'rollback'), 'b');
  assert.throws(() => selectCandidate({ ...history, pending: { candidateId: 'c' } }, 'd'), /unfinished/);
  assert.equal(selectCandidate({ ...history, pending: { candidateId: 'c' } }, 'c'), 'c');
  assert.equal(selectCandidate({ current: null, pending: { candidateId: 'c' } }, 'corrected-first'), 'corrected-first');
  assert.throws(() => selectCandidate({}, 'rollback'), /No previous/);
  const restored = successfulDeployment(history, { candidateId: 'a', metadataSha256: 'hash' });
  assert.equal(restored.current.candidateId, 'a');
  assert.equal(restored.previous.candidateId, 'b');
  assert.equal(restored.pending, null);
  assert.equal(successfulDeployment(history, { candidateId: 'b' }).previous.candidateId, 'a');
});

test('candidate manifests reject platform resources, other namespaces, and mutable images', async t => {
  const { candidate } = await fixture(t);
  const resources = ['backend', 'frontend', 'redis'].map(name => ({ kind: 'Deployment', metadata: { name, namespace: 'lab-identity' }, spec: {
    replicas: 1, template: { spec: { containers: [{ name, image: candidate.images[name]?.reference || 'redis:8.4.1-alpine', imagePullPolicy: 'Never' }] } },
  } }));
  validateDeployment(resources, candidate);
  assert.throws(() => validateDeployment([...resources, { kind: 'Namespace', metadata: { name: 'other' } }], candidate), /namespace/);
  const foreign = structuredClone(resources); foreign[0].metadata.namespace = 'identity';
  assert.throws(() => validateDeployment(foreign, candidate), /namespace/);
  resources[0].spec.template.spec.containers[0].image = 'lab-identity-backend:local';
  assert.throws(() => validateDeployment(resources, candidate), /immutable/);
});

test('runtime verification rejects an unexpected digest and an unready pod', async t => {
  const { candidate } = await fixture(t);
  const image = candidate.images.backend;
  const pod = { metadata: {}, spec: { containers: [{ name: 'backend', image: image.reference }] }, status: {
    conditions: [{ type: 'Ready', status: 'True' }], containerStatuses: [{ name: 'backend', ready: true, imageID: `containerd://${image.configDigest}` }],
  } };
  validateRunningPods([pod], 'backend', image, 1);
  pod.status.containerStatuses[0].imageID = 'containerd://sha256:' + 'f'.repeat(64);
  assert.throws(() => validateRunningPods([pod], 'backend', image, 1), /do not match/);
  pod.status.containerStatuses[0].imageID = `containerd://${image.configDigest}`;
  pod.status.conditions[0].status = 'False';
  assert.throws(() => validateRunningPods([pod], 'backend', image, 1), /do not match/);
});

test('preflight reads kubectl multi-document JSON and List output without confusing quoted braces', () => {
  const resources = [{ kind: 'Service', metadata: { name: 'one', annotations: { example: 'escaped \\" { } [ ]' } } }, { kind: 'Deployment', metadata: { name: 'two' } }];
  assert.deepEqual(readKubernetesResources(resources.map(resource => JSON.stringify(resource, null, 2)).join('\n')), resources);
  assert.deepEqual(readKubernetesResources(JSON.stringify({ kind: 'List', items: resources })), resources);
  assert.throws(() => readKubernetesResources('{"kind":"Deployment"'), /Incomplete/);
  assert.throws(() => readKubernetesResources('not json'), /Invalid/);
});
