'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    router.push('/directory');
  }

  return (
    <main className="container" style={{ padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28 }}>Log in</h1>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && <p style={{ color: '#b3261e', fontSize: 14, marginTop: 12 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
