#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export function assembleRealm(base, users, projects, secrets) {
  const realm = structuredClone(base);
  realm.clients = []; realm.users = structuredClone(users); realm.clientScopeMappings = {};
  for (const user of realm.users) {
    if (!user.serviceAccountClientId) {
      user.realmRoles = [...new Set([...(user.realmRoles ?? []), ...(realm.defaultRoles ?? [])])];
    }
  }
  realm.roles.client = {};
  for (const project of projects) {
    for (const client of project.clients) {
      if (realm.clients.some(c => c.clientId === client.clientId)) throw new Error('Duplicate identity client');
      const value = structuredClone(client);
      if (value.secret?.startsWith('${')) {
        const key = value.secret.slice(2, -1);
        if (!secrets[key]) throw new Error(`Missing secret ${key}`);
        value.secret = secrets[key];
      }
      realm.clients.push(value);
    }
    for (const [client, roles] of Object.entries(project.roles)) realm.roles.client[client] = roles;
    for (const [client, mappings] of Object.entries(project.scopeMappings)) {
      (realm.clientScopeMappings[client] ??= []).push(...mappings);
    }
  }
  return realm;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const infra = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const workspace = resolve(infra, '..');
  const privateDir = resolve(infra, '.local/identity');
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const secrets = {};
  for (const key of ['KEYCLOAK_DATABASE_PASSWORD','KEYCLOAK_ADMIN_PASSWORD','HERO_ASSOCIATION_BFF_OIDC_CLIENT_SECRET','LAB_IDENTITY_OIDC_CLIENT_SECRET','LAB_IDENTITY_ADMIN_CLIENT_SECRET','LAB_IDENTITY_STATE_SECRET','LAB_IDENTITY_CSRF_SECRET']) {
    const path = resolve(privateDir, key);
    if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString('hex'), { mode: 0o600 });
    secrets[key] = readFileSync(path, 'utf8').trim();
  }
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  const realm = assembleRealm(read(resolve(infra, 'platform/identity/realm.json')), read(resolve(infra, 'platform/identity/users.json')),
    read(resolve(infra, 'clusters/lab/identity.json')).applications.map(p => read(resolve(infra, 'apps', p, 'identity/clients.json'))), secrets);
  writeFileSync(resolve(privateDir, 'lab-realm.json'), JSON.stringify(realm, null, 2), { mode: 0o600 });
  console.log('Generated shared realm with scoped application clients.');
}
