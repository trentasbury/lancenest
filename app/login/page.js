'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmEmail = searchParams.get('confirmEmail') === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile?.role === 'freelancer') {
        router.push('/dashboard/freelancer');
      } else if (profile?.role === 'client') {
        router.push('/dashboard/client');
      } else {
        router.push('/directory');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="plain-surface container" style={{ padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28 }}>Log in (TEST — no captcha)</h1>

      {confirmEmail && (
        <p style={{ background: 'var(--marble-dim)', border: '1px solid var(--line)', borderRadius: 6, padding: '12px 16px', fontSize: 14, marginTop: 16, maxWidth: 440 }}>
          Check your inbox — confirm your email, then log in here.
        </p>
      )}

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

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
