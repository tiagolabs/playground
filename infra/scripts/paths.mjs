import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export const infraDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const workspaceDirectory = resolve(infraDirectory, '..');
export const projectsDirectory = resolve(workspaceDirectory, 'projects');
export const localStateDirectory = resolve(infraDirectory, '.local/local');
export const kubeconfig = process.env.LAB_KUBECONFIG || process.env.HERO_ASSOCIATION_K3D_KUBECONFIG || resolve(localStateDirectory, 'kubeconfig');

export function applicationPaths(name) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name) || !existsSync(resolve(infraDirectory, 'apps', name))) throw new Error('Unknown lab application');
  return {
    source: resolve(projectsDirectory, name),
    config: resolve(infraDirectory, 'apps', name),
    pipeline: resolve(infraDirectory, 'pipelines', name),
    operations: resolve(infraDirectory, 'apps', name, 'operations'),
    tests: resolve(infraDirectory, 'tests', name),
    privateDirectory: resolve(localStateDirectory, 'apps', name),
    artifacts: resolve(localStateDirectory, 'pipelines', name, 'artifacts'),
  };
}
