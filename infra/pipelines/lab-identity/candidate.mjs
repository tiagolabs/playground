import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applicationPaths, workspaceDirectory, infraDirectory, localStateDirectory } from '../../scripts/paths.mjs';
import { fileSha256, inspectImageArchive, sha256 } from '../shared/image-archive.mjs';

export const app = applicationPaths('lab-identity');
export const stateDirectory = resolve(localStateDirectory, 'pipelines/lab-identity');
export const candidatesDirectory = resolve(stateDirectory, 'candidates');
export const components = ['backend', 'frontend'];

export function validateCandidateId(id) {
  if (typeof id !== 'string' || id === 'rollback' || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(id)) throw new Error('Candidate ID must contain 1–100 lowercase letters, digits, periods, underscores, or hyphens; rollback is reserved');
  return id;
}

export function candidateDirectory(id, root = candidatesDirectory) {
  return resolve(root, validateCandidateId(id));
}

function files(directory) {
  return readdirSync(directory).sort().flatMap(name => {
    if (['target', 'node_modules', 'dist', '.local'].includes(name)) return [];
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

export function sourceDigest() {
  const hash = createHash('sha256');
  const inputs = [resolve(app.source, 'backend'), resolve(app.source, 'frontend'), app.config, app.pipeline,
    ...['application.sh', 'common.sh', 'paths.mjs'].map(name => resolve(infraDirectory, 'scripts', name)),
    resolve(infraDirectory, 'pipelines/shared/image-archive.mjs')];
  for (const file of inputs.flatMap(path => statSync(path).isDirectory() ? files(path) : [path]).sort()) {
    hash.update(relative(workspaceDirectory, file)); hash.update('\0');
    hash.update(readFileSync(file)); hash.update('\0');
  }
  return hash.digest('hex');
}

export function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function tags(id) {
  return Object.fromEntries(components.map(component => [component, `lab-identity-${component}:${id}`]));
}

export async function verifyCandidate(id, root = candidatesDirectory) {
  const directory = candidateDirectory(id, root);
  const metadataBytes = readFileSync(resolve(directory, 'candidate.json'));
  const metadata = JSON.parse(metadataBytes);
  if (metadata.version !== 1 || metadata.application !== 'lab-identity' || metadata.candidateId !== id || metadata.validation !== 'passed' || !/^[a-f0-9]{64}$/.test(metadata.sourceDigest)) throw new Error('Candidate has no valid passing build record');
  if (await fileSha256(resolve(directory, 'images.tar')) !== metadata.archiveSha256) throw new Error('Candidate image archive checksum mismatch');
  if (sha256(readFileSync(resolve(directory, 'deployment.yaml'))) !== metadata.deploymentSha256) throw new Error('Candidate deployment manifest checksum mismatch');
  const images = inspectImageArchive(resolve(directory, 'images.tar'), tags(id));
  if (JSON.stringify(images) !== JSON.stringify(metadata.images)) throw new Error('Candidate image metadata does not match its archive');
  return { ...metadata, directory, metadataSha256: sha256(metadataBytes) };
}

async function record(expectedDigest, id, temporary) {
  const destination = candidateDirectory(id);
  if (existsSync(destination)) throw new Error('Candidate already exists; choose a new ID');
  if (sourceDigest() !== expectedDigest) throw new Error('Source changed during validation; rebuild the candidate');
  const images = inspectImageArchive(resolve(temporary, 'images.tar'), tags(id));
  cpSync(app.config, resolve(temporary, 'deployment-config'), { recursive: true });
  const overlay = resolve(temporary, 'deployment-config/overlays/local');
  const kustomization = resolve(overlay, 'kustomization.yaml');
  writeFileSync(kustomization, `${readFileSync(kustomization, 'utf8')}\nimages:\n${components.map(component => `  - name: lab-identity-${component}\n    newName: docker.io/library/lab-identity-${component}\n    digest: ${images[component].rootDigest}\n`).join('')}`);
  const deployment = execFileSync('kubectl', ['kustomize', overlay], { maxBuffer: 4 * 1024 * 1024 });
  writeFileSync(resolve(temporary, 'deployment.yaml'), deployment, { mode: 0o600 });
  if (sourceDigest() !== expectedDigest) throw new Error('Source changed while archiving deployment configuration');
  const metadata = {
    version: 1, application: 'lab-identity', candidateId: id, validation: 'passed',
    validatedAt: new Date().toISOString(), sourceDigest: expectedDigest,
    archiveSha256: await fileSha256(resolve(temporary, 'images.tar')),
    deploymentSha256: sha256(deployment), images,
  };
  atomicJson(resolve(temporary, 'candidate.json'), metadata);
  mkdirSync(candidatesDirectory, { recursive: true, mode: 0o700 });
  renameSync(temporary, destination);
  atomicJson(resolve(stateDirectory, 'latest.json'), { candidateId: id });
  console.log(`Verified candidate: ${id}\nArchive: ${destination}\nPromote: infra/pipelines/lab-identity/deploy.sh ${id}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, ...args] = process.argv.slice(2);
    if (action === 'digest' && args.length === 0) console.log(sourceDigest());
    else if (action === 'preflight' && args.length === 1) {
      const id = validateCandidateId(args[0]);
      if (existsSync(candidateDirectory(id))) throw new Error('Candidate already exists; choose a new ID');
      for (const tag of Object.values(tags(id))) {
        let exists = false;
        try { execFileSync('docker', ['image', 'inspect', tag], { stdio: 'ignore' }); exists = true; } catch { /* Tag is unused. */ }
        if (exists) throw new Error(`Image tag already exists: ${tag}`);
      }
    } else if (action === 'record' && args.length === 3) await record(...args);
    else if (action === 'verify' && args.length === 1) {
      const candidate = await verifyCandidate(args[0]);
      console.log(`Verified candidate ${candidate.candidateId}; archive and deployment checksums match.`);
    } else if (action === 'list' && args.length === 0) {
      const historyPath = resolve(stateDirectory, 'deployment.json');
      const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath)) : {};
      for (const id of existsSync(candidatesDirectory) ? readdirSync(candidatesDirectory).sort() : []) {
        if (!existsSync(resolve(candidatesDirectory, id, 'candidate.json'))) continue;
        const candidate = JSON.parse(readFileSync(resolve(candidatesDirectory, id, 'candidate.json')));
        const labels = ['current', 'previous', 'pending'].filter(label => history[label]?.candidateId === id);
        console.log(`${id}\t${candidate.validatedAt}\t${labels.join(',') || 'available'}`);
      }
    } else throw new Error('Usage: candidate.mjs digest|preflight ID|record SOURCE_DIGEST ID DIRECTORY|verify ID|list');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
