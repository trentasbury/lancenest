'use client';

import { Suspense, useEffect, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function LoginForm() {
  const searchParams = useSearchParams();
  const confirmEmail = searchParams.get('confirmEmail') === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  useEffect(() => {
    window.onTurnstileSuccessLogin = (token) => setCaptchaToken(token);
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

    // Hard safety net: no matter what happens below, force a redirect
    // after 6 seconds so this can never hang on this screen forever.
    const safetyTimeout = setTimeout(() => {
      window.location.href = '/directory';
    }, 6000);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });

      if (loginError) {
        clearTimeout(safetyTimeout);
        setError(loginError.message);
        if (window.turnstile) window.turnstile.reset();
        setCaptchaToken('');
        setLoading(false);
        return;
      }

      let destination = '/directory';
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.role === 'freelancer') destination = '/dashboard/freelancer';
        else if (profile?.role === 'client') destination = '/dashboard/client';
      } catch (profileErr) {
        console.error('Profile lookup error (continuing to directory):', profileErr);
      }

      clearTimeout(safetyTimeout);
      window.location.href = destination;
    } catch (err) {
      clearTimeout(safetyTimeout);
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="plain-surface container" style={{ padding: '48px 24px' }}>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />

      <h1 style={{ fontSize: 28 }}>Log in</h1>

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

        <div
          className="cf-turnstile"
          data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          data-callback="onTurnstileSuccessLogin"
          style={{ marginTop: 20 }}
        />

        {error && <p style={{ color: '#b3261e', fontSize: 14, marginTop: 12 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 13 }}>
        <a href="/forgot-password" style={{ color: 'var(--wood)', textDecoration: 'underline' }}>Forgot password?</a>
      </p>
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
