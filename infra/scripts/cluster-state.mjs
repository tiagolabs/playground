import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const clusterName = 'tiagolabs-local';

export function clusterState(clusters) {
  if (!Array.isArray(clusters)) throw new Error('Invalid k3d cluster inventory');
  const cluster = clusters.find(entry => entry.name === clusterName);
  if (!cluster) return { name: clusterName, state: 'absent' };
  const nodes = cluster.nodes.filter(node => ['server', 'agent', 'loadbalancer'].includes(node.role));
  const running = nodes.filter(node => node.State?.Running === true).length;
  return {
    name: clusterName,
    state: running === nodes.length && nodes.length > 0 ? 'running' : running === 0 ? 'stopped' : 'partial',
    runningNodes: running,
    totalNodes: nodes.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const state = clusterState(JSON.parse(readFileSync(0, 'utf8')));
    console.log(process.argv[2] === 'state' ? state.state : JSON.stringify(state));
  } catch {
    console.error('Could not read the k3d cluster inventory.');
    process.exitCode = 1;
  }
}
