'use client';

import { Suspense, useEffect, useState } from 'react';
import Script from 'next/script';
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
  const [captchaToken, setCaptchaToken] = useState('');

  useEffect(() => {
    window.onTurnstileSuccess = (token) => setCaptchaToken(token);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!captchaToken) {
      setError('Please complete the verification check.');
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        captchaToken,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      if (window.turnstile) window.turnstile.reset();
      setCaptchaToken('');
      return;
    }

    if (!data.session) {
      router.push('/login?confirmEmail=true');
      return;
    }

    router.push(role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/client');
  }

  return (
    <main className="plain-surface container" style={{ padding: '48px 24px' }}>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />

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

        <div
          className="cf-turnstile"
          data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          data-callback="onTurnstileSuccess"
          style={{ marginTop: 20 }}
        />

        {error && <p style={{ color: '#b3261e', fontSize: 14, marginTop: 12 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 24, fontSize: 13, color: 'var(--slate)' }}>
        Curious about pricing? <a href="/pricing" style={{ color: 'var(--wood)', textDecoration: 'underline' }}>View our pricing page</a>.
      </p>
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
