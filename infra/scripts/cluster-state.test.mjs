import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { clusterState } from './cluster-state.mjs';
import { infraDirectory } from './paths.mjs';

const inventory = states => [{ name: 'another-cluster', nodes: [{ role: 'server', State: { Running: true } }] }, {
  name: 'tiagolabs-local', secret: 'must-never-appear',
  nodes: states.map((running, index) => ({ role: index === 0 ? 'server' : 'agent', State: { Running: running } })),
}];

test('cluster summary exposes only this cluster and distinguishes lifecycle states', () => {
  assert.deepEqual(clusterState([]), { name: 'tiagolabs-local', state: 'absent' });
  assert.equal(clusterState(inventory([false, false, false])).state, 'stopped');
  assert.equal(clusterState(inventory([true, false, true])).state, 'partial');
  assert.deepEqual(clusterState(inventory([true, true, true])), { name: 'tiagolabs-local', state: 'running', runningNodes: 3, totalNodes: 3 });
  assert.throws(() => clusterState({}), /Invalid/);
});

function fixture(t, inventoryText, context = 'k3d-tiagolabs-local') {
  const directory = mkdtempSync(resolve(tmpdir(), 'lab-lifecycle-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = resolve(directory, 'commands');
  const profile = resolve(directory, 'kubeconfig');
  writeFileSync(log, '');
  writeFileSync(profile, 'original scoped credential');
  writeFileSync(resolve(directory, 'k3d'), '#!/usr/bin/env bash\nprintf "k3d %s\\n" "$*" >> "$LAB_TEST_LOG"\nif [[ "$*" == "cluster list -o json" ]]; then printf "%s" "$LAB_TEST_INVENTORY"; fi\n', { mode: 0o700 });
  writeFileSync(resolve(directory, 'kubectl'), '#!/usr/bin/env bash\nprintf "kubectl %s\\n" "$*" >> "$LAB_TEST_LOG"\nif [[ "$*" == "config current-context" ]]; then printf "%s\\n" "$LAB_TEST_CONTEXT"; fi\n', { mode: 0o700 });
  const result = spawnSync('bash', [resolve(infraDirectory, 'scripts/create-cluster.sh')], {
    encoding: 'utf8', env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, K3D_BIN: resolve(directory, 'k3d'), LAB_KUBECONFIG: profile,
      LAB_TEST_LOG: log, LAB_TEST_INVENTORY: inventoryText, LAB_TEST_CONTEXT: context },
  });
  return { result, commands: readFileSync(log, 'utf8'), profile: readFileSync(profile, 'utf8') };
}

test('startup resumes an existing stopped cluster and preserves scoped credentials', t => {
  const { result, commands, profile } = fixture(t, JSON.stringify(inventory([false, false, false])));
  assert.equal(result.status, 0, result.stderr);
  assert.match(commands, /k3d cluster start tiagolabs-local --wait --timeout 180s/);
  assert.doesNotMatch(commands, /cluster create|kubeconfig get|k3d .*--all/);
  assert.equal(profile, 'original scoped credential');
});

test('startup repairs a partially running cluster and leaves a running cluster alone', t => {
  assert.match(fixture(t, JSON.stringify(inventory([true, false, true]))).commands, /cluster start tiagolabs-local/);
  const running = fixture(t, JSON.stringify(inventory([true, true, true])));
  assert.equal(running.result.status, 0);
  assert.doesNotMatch(running.commands, /cluster start|cluster create/);
});

test('startup creates only the configured missing cluster', t => {
  const { result, commands } = fixture(t, '[]');
  assert.equal(result.status, 0, result.stderr);
  assert.match(commands, /cluster create --config .*infra\/clusters\/local\/k3d.yaml --wait/);
  assert.doesNotMatch(commands, /cluster start|another-cluster|k3d .*--all/);
});

test('bad inventory and a foreign context fail before any cluster mutation', t => {
  const bad = fixture(t, 'not-json');
  assert.notEqual(bad.result.status, 0);
  assert.doesNotMatch(bad.commands, /cluster start|cluster create|kubeconfig get/);
  const foreign = fixture(t, '[]', 'k3d-another-cluster');
  assert.notEqual(foreign.result.status, 0);
  assert.doesNotMatch(foreign.commands, /k3d /);
  assert.equal(foreign.profile, 'original scoped credential');
});
