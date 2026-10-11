#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const infra=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env={...process.env,KUBECONFIG:process.env.LAB_KUBECONFIG || resolve(infra,'.local/kubeconfig')};
if(execFileSync('kubectl',['config','current-context'],{env,encoding:'utf8'}).trim()!=='k3d-cluster-lab') throw new Error('Refusing identity changes outside cluster-lab');
const realm=JSON.parse(readFileSync(resolve(infra,'.local/identity/lab-realm.json'),'utf8'));
const password=readFileSync(resolve(infra,'.local/identity/KEYCLOAK_ADMIN_PASSWORD'),'utf8').trim();
const forward=spawn('kubectl',['-n','identity','port-forward','--address','127.0.0.1','service/keycloak',':8080'],{env,stdio:['ignore','pipe','pipe']});
try {
 const port=await new Promise((yes,no)=>{let output='';const timer=setTimeout(()=>no(new Error('Identity port-forward timed out')),20000);forward.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);yes(match[1]);}});forward.once('exit',()=>{clearTimeout(timer);no(new Error('Identity port-forward stopped'));});});
 const base=`http://127.0.0.1:${port}`;
 const login=await fetch(`${base}/realms/master/protocol/openid-connect/token`,{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'lab-bootstrap-admin',password}),signal:AbortSignal.timeout(10000)});
 if(!login.ok)throw new Error('Shared identity administrator login failed');
 const token=(await login.json()).access_token;
 async function api(method,path,body) {
   const r=await fetch(`${base}/admin/realms/lab${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw new Error(`Identity configuration failed: ${method} ${path} (${r.status})`);
   return r.status===204 || r.headers.get('content-length')==='0'?null:r.json();
 }
 const ids=new Map((await api('GET','/clients')).map(c=>[c.clientId,c.id]));
 for(const client of realm.clients) {
   if(ids.has(client.clientId))await api('PUT',`/clients/${ids.get(client.clientId)}`,client);
   else {await api('POST','/clients',client);ids.set(client.clientId,(await api('GET',`/clients?clientId=${encodeURIComponent(client.clientId)}`))[0].id);}
 }
 for(const [client,roles] of Object.entries(realm.roles.client)) {
   const current=await api('GET',`/clients/${ids.get(client)}/roles`);
   for(const role of roles)if(!current.some(r=>r.name===role.name))await api('POST',`/clients/${ids.get(client)}/roles`,role);
 }
 for(const [roleClient,mappings] of Object.entries(realm.clientScopeMappings)) {
   for(const binding of mappings) {
    const roles=await Promise.all(binding.roles.map(name=>api('GET',`/clients/${ids.get(roleClient)}/roles/${encodeURIComponent(name)}`)));
    await api('POST',`/clients/${ids.get(binding.client)}/scope-mappings/clients/${ids.get(roleClient)}`,roles);
   }
 }
 // Keep the realm's shared self-service defaults aligned without changing per-app grants.
 for (const role of realm.roles.realm ?? []) {
   for (const [client, names] of Object.entries(role.composites?.client ?? {})) {
     const roles = await Promise.all(names.map(name =>
       api('GET', `/clients/${ids.get(client)}/roles/${encodeURIComponent(name)}`)));
     await api('POST', `/roles/${encodeURIComponent(role.name)}/composites`, roles);
   }
 }
 // Existing users and their application grants remain untouched.
 console.log(`Synchronized ${realm.clients.length} shared identity clients and their declared role scopes.`);
} finally {forward.kill();}
