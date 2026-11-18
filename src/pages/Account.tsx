import { useState } from 'react';
import { cloudEnabled, signIn, signOut, signUp, syncAll, useCloud } from '../lib/cloud';

/** Sign in to keep your openings and progress online and in sync across devices. */
export function Account() {
  const c = useCloud();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!cloudEnabled) {
    return (
      <section className="panel">
        <h3>Online account</h3>
        <p className="muted">Online saving is not switched on for this copy of the app, so your data stays in this browser. To enable accounts, follow “Online accounts” in the README (a free Supabase project), then rebuild.</p>
      </section>
    );
  }
  const run = async (fn: () => Promise<string>) => { setBusy(true); setMsg(''); setMsg(await fn()); setBusy(false); };

  return (
    <section className="panel">
      <h3>Online account</h3>
      {c.user ? (
        <>
          <p>Signed in as <strong>{c.user.email}</strong></p>
          <p className={c.error ? 'err' : 'muted'} role="status">
            {c.syncing ? 'Syncing…' : c.error ? `Sync problem: ${c.error}` : c.last ? `Synced at ${new Date(c.last).toLocaleTimeString()}. Changes save automatically.` : 'Waiting for the first sync…'}
          </p>
          <div className="row"><button className="primary" onClick={() => void syncAll()} disabled={c.syncing}>Sync now</button><button onClick={() => void signOut()}>Sign out</button></div>
        </>
      ) : (
        <>
          <p className="muted">Sign in to keep your openings and progress online, on every device.</p>
          <input type="email" placeholder="Email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" />
          <input type="password" placeholder="Password (6+ characters)" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} aria-label="Password" />
          {msg && <p className={msg.startsWith('Check your email') ? 'ok' : 'err'} role="alert">{msg}</p>}
          <div className="row">
            <button className="primary" disabled={busy || !email || !pw} onClick={() => run(() => signIn(email, pw))}>Sign in</button>
            <button disabled={busy || !email || pw.length < 6} onClick={() => run(() => signUp(email, pw))}>Create account</button>
          </div>
        </>
      )}
    </section>
  );
}
