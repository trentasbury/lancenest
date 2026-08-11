'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import MessageButton from '../../../components/MessageButton';

export default function ApplicantsList({ listingId, clientId }) {
  const [applications, setApplications] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || user.id !== clientId) return;
      setIsOwner(true);

      const { data } = await supabase
        .from('job_applications')
        .select('id, message, status, created_at, profiles(id, full_name, headline, hourly_rate)')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      setApplications(data || []);
    }
    load();
  }, [listingId, clientId]);

  if (!isOwner || !applications) return null;

  return (
    <div style={{ marginTop: 40 }}>
      <h3 style={{ marginBottom: 16 }}>Applicants ({applications.length})</h3>
      {applications.length === 0 && <p className="meta">No applicants yet.</p>}
      {applications.map((app) => (
        <div key={app.id} className="card" style={{ marginBottom: 1 }}>
          <a href={`/profile/${app.profiles?.id}`}>
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>{app.profiles?.full_name}</h3>
          </a>
          <p className="meta" style={{ marginBottom: 8 }}>{app.profiles?.headline}</p>
          {app.message && <p style={{ fontSize: 14.5, color: 'var(--slate)', marginBottom: 10 }}>{app.message}</p>}
          <MessageButton otherUserId={app.profiles?.id} />
        </div>
      ))}
    </div>
  );
}
