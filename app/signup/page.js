'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function SignupForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [role, setRole] = useState(params.get('role') === 'client' ? 'client' : 'freelancer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
      });
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    router.push(role === 'freelancer' ? '/dashboard/freelancer' : '/directory');
  }

  return (
    <main className="container" style={{ padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28 }}>Create your account</h1>

      <div style={{ display: 'flex', gap: 10, margin: '16px 0 8px' }}>
        <button
          type="button"
          className={role === 'freelancer' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setRole('freelancer')}
        >
          I'm a freelancer
        </button>
        <button
          type="button"
          className={role === 'client' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setRole('client')}
        >
          I'm hiring
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label>Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />

        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />

        {error && <p style={{ color: '#b3261e', fontSize: 14, marginTop: 12 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </main>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
