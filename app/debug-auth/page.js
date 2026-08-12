'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Deliberately bypasses everything else in the app — no shared lib file,
// no other components, no redirects. Just: try to check auth, show
// exactly what happens, with a visible timer.

export default function DebugAuth() {
  const [status, setStatus] = useState('Starting...');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    async function run() {
      try {
        setStatus('Creating Supabase client...');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        setStatus('Calling getSession()...');
        const { data, error } = await supabase.auth.getSession();

        clearInterval(timer);
        setStatus('Done');
        setResult({
          success: true,
          hasSession: !!data?.session,
          error: error ? error.message : null,
          timeTaken: ((Date.now() - startTime) / 1000).toFixed(2) + 's',
        });
      } catch (err) {
        clearInterval(timer);
        setStatus('Threw an exception');
        setResult({
          success: false,
          errorMessage: err.message,
          errorName: err.name,
          timeTaken: ((Date.now() - startTime) / 1000).toFixed(2) + 's',
        });
      }
    }
    run();

    return () => clearInterval(timer);
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: 'monospace', fontSize: 14, lineHeight: 1.8 }}>
      <h1 style={{ fontFamily: 'monospace', fontSize: 20 }}>Auth Debug</h1>
      <p><strong>Status:</strong> {status}</p>
      <p><strong>Elapsed:</strong> {elapsed}s</p>
      {result && (
        <pre style={{ background: '#f0f0f0', padding: 16, borderRadius: 8, marginTop: 16, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      <p style={{ marginTop: 24, color: '#666' }}>
        NEXT_PUBLIC_SUPABASE_URL set: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'yes' : 'NO — MISSING'}
        <br />
        NEXT_PUBLIC_SUPABASE_ANON_KEY set: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'yes' : 'NO — MISSING'}
      </p>
    </main>
  );
}
