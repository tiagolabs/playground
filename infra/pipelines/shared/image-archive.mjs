import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function fileSha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function archiveJson(archive, entry) {
  const bytes = execFileSync('tar', ['-xOf', archive, entry], { maxBuffer: 8 * 1024 * 1024 });
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
}

function blob(archive, digest) {
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid OCI digest');
  const result = archiveJson(archive, `blobs/sha256/${digest.slice(7)}`);
  if (`sha256:${sha256(result.bytes)}` !== digest) throw new Error('OCI blob checksum mismatch');
  return result.value;
}

// Docker Desktop exports OCI archives. Keep the root digest for imports and
// check the lab's platform manifest and config for runtime verification.
export function inspectImageArchive(archive, tags, platform = 'linux/amd64') {
  const [os, architecture] = platform.split('/');
  const index = archiveJson(archive, 'index.json').value;
  return Object.fromEntries(Object.entries(tags).map(([component, tag]) => {
    const canonicalTag = `docker.io/library/${tag}`;
    const matches = index.manifests?.filter(entry => entry.annotations?.['io.containerd.image.name'] === canonicalTag);
    if (matches?.length !== 1) throw new Error(`Archive has no unique image for ${tag}`);
    const rootDigest = matches[0].digest;
    const root = blob(archive, rootDigest);
    let manifestDigest = rootDigest;
    let manifest = root;
    if (root.manifests) {
      const variants = root.manifests.filter(entry => entry.platform?.os === os && entry.platform?.architecture === architecture);
      if (variants.length !== 1) throw new Error(`Archive has no unique ${platform} image for ${tag}`);
      manifestDigest = variants[0].digest;
      manifest = blob(archive, manifestDigest);
    }
    const configDigest = manifest.config?.digest;
    const config = blob(archive, configDigest);
    if (config.os !== os || config.architecture !== architecture) throw new Error(`Unexpected platform for ${tag}`);
    return [component, {
      tag: canonicalTag,
      reference: `docker.io/library/${tag.split(':')[0]}@${rootDigest}`,
      rootDigest,
      manifestDigest,
      configDigest,
      platform,
    }];
  }));
}
