import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [newUser, setNewUser] = useState({username:'',email:'',firstName:'',lastName:''});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function api(path, method='GET', data) {
    const response = await fetch('/api/v1/'+path, {method, credentials:'same-origin', headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest', ...(method==='GET'?{}:{'X-CSRF-TOKEN':session?.csrfToken ?? ''})}, ...(data===undefined ? {} : {body:JSON.stringify(data)})});
    if (!response.ok) {
      const body=await response.json().catch(()=>({}));
      if ([401,499].includes(response.status)) {setSession(null);throw new Error('Your session expired. Sign in again.');}
      throw new Error(body.message || (response.status===403 ? 'You do not have access to this action.' : 'The request could not be completed.'));
    }
    return response.status===204 ? null : response.json();
  }
  async function action(work) {setBusy(true);setError('');setNotice('');try {await work();}catch(e){setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{fetch('/api/v1/session').then(r=>{if(!r.ok)throw new Error('Could not load your session.');return r.json();}).then(setSession).catch(e=>setError(e.message));},[]);
  useEffect(()=>{if(session?.authenticated && session.appUser) {
    Promise.all([api('applications'),api('profile')]).then(([apps,user])=>{setApplications(apps);setProfile(user);}).catch(e=>setError(e.message));
  }},[session]);
  async function loadUsers(){setUsers(await api('admin/users?search='+encodeURIComponent(search)));}
  useEffect(()=>{if(tab==='users' && session?.admin) action(loadUsers);},[tab]);
  async function selectUser(id){setSelected(await api('admin/users/'+id));}
  const fields=(value, setter, prefix='')=><>{['firstName','lastName','email'].map(key=><label key={key}>{({firstName:'First name',lastName:'Last name',email:'Email'})[key]}<input required type={key==='email'?'email':'text'} name={prefix+key} maxLength={key==='email'?254:100} value={value[key] || ''} onChange={e=>setter({...value,[key]:e.target.value})}/></label>)}</>;
  return <><header><a href="/" className="brand"><span className="mark">L</span> Lab Identity</a><span className="environment">CLUSTER LAB</span><div className="header-right">{session?.authenticated && <><span>{profile?.username}</span><a href="/auth/logout">Sign out</a></>}</div></header>
    <main>{error && <div className="message error" role="alert">{error}</div>}{notice && <div className="message" role="status">{notice}</div>}
      {!session ? <p>Loading your session…</p> : !session.authenticated ? <section className="welcome"><p className="eyebrow">YOUR STUDY WORKSPACE</p><h1>One account.<br/>Your applications.</h1><p>Manage your profile and the projects you can access in Cluster Lab.</p><a className="button" href="/auth/login">Sign in</a></section> : !session.appUser ? <section><h1>Access required</h1><p>Ask a lab administrator for Lab Identity access.</p></section> : <>
      <nav aria-label="Workspace">{[['applications','Applications'],['profile','My profile'],...(session.admin?[['users','Users & access']]:[])].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      {tab==='applications' && <section><p className="eyebrow">APPLICATION CATALOGUE</p><h1>Your workspace</h1><p className="muted">Each application has its own access grant. Contact a lab administrator to request access.</p><div className="cards">{applications.map(app=><article className="card" key={app.id}><span className={'badge '+(app.granted?'green':'')}>{!app.available?'Planned':app.granted?'Access granted':'Access required'}</span><h2>{app.name}</h2><p>{({'lab-identity':'Your account and application access.','hero-association':'Build your agency, recruit heroes, and explore dungeons.','pix-integration':'A future Pix integration study project.'})[app.id]}</p>{app.granted && app.available ? <a className="button secondary" href={app.url}>Open application ↗</a> : <span className="muted">{app.available?'Ask an administrator for access':'Coming later'}</span>}</article>)}</div></section>}
      {tab==='profile' && profile && <section className="narrow"><p className="eyebrow">ACCOUNT</p><h1>My profile</h1><form onSubmit={e=>{e.preventDefault();action(async()=>{setProfile(await api('profile','PUT',profile));setNotice('Profile saved.');});}}><p>Username: <strong>{profile.username}</strong></p>{fields(profile,setProfile)}<button disabled={busy}>Save profile</button></form><p className="muted">Changing your email clears its verification.</p><a href="https://auth.lab.test/realms/lab/account">Manage password and account security ↗</a></section>}
      {tab==='users' && session.admin && <section><p className="eyebrow">ADMINISTRATION</p><h1>Users & application access</h1><div className="admin-grid"><aside><form className="search" onSubmit={e=>{e.preventDefault();action(loadUsers);}}><label>Find a user<input aria-label="Find a user" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)}/></label><button disabled={busy}>Search</button></form><ul className="users">{users.map(user=><li key={user.id}><button onClick={()=>action(()=>selectUser(user.id))}><strong>{user.username}</strong><span>{user.email}</span><small>{user.enabled?'Enabled':'Disabled'}</small></button></li>)}</ul><button className="secondary" onClick={()=>setSelected(null)}>Create a user</button></aside>
      <div>{selected ? <><h2>{selected.profile.username}</h2><form onSubmit={e=>{e.preventDefault();action(async()=>{const result=await api('admin/users/'+selected.profile.id,'PUT',selected.profile);setSelected({...selected,profile:result});await loadUsers();setNotice('User saved.');});}}>{fields(selected.profile,value=>setSelected({...selected,profile:value}),'user-')}<label className="checkbox"><input type="checkbox" checked={selected.profile.enabled} disabled={selected.profile.id===session.subject} onChange={e=>setSelected({...selected,profile:{...selected.profile,enabled:e.target.checked}})}/> Account enabled</label><button disabled={busy}>Save user</button></form><h3>Application access</h3><div className="grants">{selected.applications.map(app=><label className="checkbox" key={app.id}><input type="checkbox" checked={app.granted} disabled={busy || app.id==='lab-identity'} onChange={e=>action(async()=>{await api('admin/users/'+selected.profile.id+'/applications/'+app.id,'PUT',{granted:e.target.checked});await selectUser(selected.profile.id);setNotice('Application access updated. The user must sign in again.');})}/><span>{app.name}{!app.available && <small> · Planned</small>}{app.id==='lab-identity' && <small> · Default account access</small>}</span></label>)}</div><button className="secondary" disabled={busy} onClick={()=>action(async()=>{await api('admin/users/'+selected.profile.id+'/password-reset','POST');setNotice('Password reset email sent to the local lab inbox.');})}>Send password reset email</button></> : <><h2>Create a user</h2><p className="muted">New users receive Lab Identity access. Grant other applications after creating the account, then send a password reset email.</p><form onSubmit={e=>{e.preventDefault();action(async()=>{const user=await api('admin/users','POST',newUser);await loadUsers();await selectUser(user.id);setNewUser({username:'',email:'',firstName:'',lastName:''});setNotice('User created. Set application access and send a password reset email.');});}}><label>Username<input name="username" required maxLength={100} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={newUser.username} onChange={e=>setNewUser({...newUser,username:e.target.value})}/></label>{fields(newUser,setNewUser,'new-')}<button disabled={busy}>Create user</button></form></>}</div></div><p className="muted">Showing up to 50 matching users. Narrow the search to find a specific account.</p></section>}
    </>}</main><footer>Shared identity · Explicit application access · Study environment</footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);
