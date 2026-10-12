import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { applicationPaths, workspaceDirectory, infraDirectory } from '../../scripts/paths.mjs';
const app=applicationPaths('lab-identity');
function files(directory) {
 return readdirSync(directory).sort().flatMap(name=>{
   if(['target','node_modules','dist','.local'].includes(name))return [];
   const path=resolve(directory,name);return statSync(path).isDirectory()?files(path):[path];
 });
}
function digest() {
 const hash=createHash('sha256');
 const inputs=[resolve(app.source,'backend'),resolve(app.source,'frontend'),app.config,app.pipeline,
   resolve(infraDirectory,'scripts/application.sh'),resolve(infraDirectory,'scripts/common.sh'),resolve(infraDirectory,'scripts/paths.mjs')];
 for(const file of inputs.flatMap(path=>statSync(path).isDirectory()?files(path):[path]).sort()) {
   hash.update(relative(workspaceDirectory,file));hash.update('\0');hash.update(readFileSync(file));hash.update('\0');
 }
 return hash.digest('hex');
}
function images() {return Object.fromEntries(['backend','frontend'].map(component=>[component,execFileSync('docker',['image','inspect',`lab-identity-${component}:local`,'--format','{{.Id}}'],{encoding:'utf8'}).trim()]));}
const path=resolve(infraDirectory,'.local/local/pipelines/lab-identity/candidate.json');
if(process.argv[2]==='digest')console.log(digest());
else if(process.argv[2]==='record') {
 const sourceDigest=digest();if(sourceDigest!==process.argv[3])throw new Error('Lab Identity source changed during validation; rebuild the candidate');
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({sourceDigest,images:images(),validatedAt:new Date().toISOString()},null,2));
 console.log('Recorded verified Lab Identity image IDs.');
} else if(process.argv[2]==='verify') {
 const candidate=JSON.parse(readFileSync(path,'utf8'));
 if(candidate.sourceDigest!==digest() || JSON.stringify(candidate.images)!==JSON.stringify(images()))throw new Error('Candidate source or image IDs changed; run infra/pipelines/lab-identity/build.sh again');
 console.log('Verified Lab Identity candidate image IDs and source.');
} else throw new Error('Usage: node candidate.mjs digest|record DIGEST|verify');
