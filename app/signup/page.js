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
    <main className="plain-surface
