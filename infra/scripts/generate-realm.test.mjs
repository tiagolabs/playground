import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assembleRealm } from './generate-realm.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const declarations=read('../clusters/local/identity.json').applications.map(p=>read(`../apps/${p}/identity/clients.json`));
const secrets=Object.fromEntries(['HERO_ASSOCIATION_BFF_OIDC_CLIENT_SECRET','LAB_IDENTITY_OIDC_CLIENT_SECRET','LAB_IDENTITY_ADMIN_CLIENT_SECRET'].map(k=>[k,'test-secret']));
const realm=assembleRealm(read('../platform/identity/realm.json'),read('../platform/identity/users.json'),declarations,secrets);
test('realm clients have bounded scope and browser clients use PKCE',()=>{
  assert.equal(realm.realm,'lab');
  for(const client of realm.clients)assert.equal(client.fullScopeAllowed,false,client.clientId);
  const identity=realm.clients.find(c=>c.clientId==='lab-identity');
  assert.equal(identity.attributes['pkce.code.challenge.method'],'S256');
  assert.equal(identity.directAccessGrantsEnabled,false);
  assert.deepEqual(identity.protocolMappers.map(m=>m.config['included.client.audience']),['lab-identity-api']);
  assert.deepEqual(realm.clientScopeMappings['lab-identity-api'],[{client:'lab-identity',roles:['app-user','identity-admin']}]);
});
test('only self-service access is a default entitlement',()=>{
  assert.equal(realm.registrationAllowed,false);
  assert.deepEqual(realm.roles.realm[0].composites.client,{
    account:['manage-account','view-profile'],
    'lab-identity-api':['app-user'],
  });
  assert.ok(!realm.roles.realm[0].composites.client['hero-association']);
  assert.ok(!realm.roles.realm[0].composites.client['payment-integrations']);
});
test('service account is limited and fixture subjects remain stable',()=>{
  const admin=realm.users.find(u=>u.serviceAccountClientId==='lab-identity-admin');
  assert.deepEqual(admin.clientRoles['realm-management'],['manage-users','query-users','view-clients']);
  const users=realm.users.filter(u=>u.username.startsWith('user'));
  assert.equal(users.length,3);
  assert.ok(users.every(u=>u.id && u.clientRoles['hero-association'].includes('app-user')));
  assert.ok(users.every(u=>u.realmRoles.includes('default-roles-lab')));
  assert.equal(admin.realmRoles,undefined);
});
test('duplicate clients and missing secrets fail assembly',()=>{
  assert.throws(()=>assembleRealm(read('../platform/identity/realm.json'),[],[declarations[0],declarations[0]],secrets),/Duplicate/);
  assert.throws(()=>assembleRealm(read('../platform/identity/realm.json'),[],declarations,{}),/Missing secret/);
});
