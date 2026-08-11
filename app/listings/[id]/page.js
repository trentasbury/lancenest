'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import ApplyBox from './ApplyBox';
import ApplicantsList from './ApplicantsList';
import MessageButton from '../../../components/MessageButton';

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);

      const { data } = await supabase
        .from('job_listings')
        .select('*, profiles(full_name, id)')
        .eq('id', id)
        .single();

      setListing(data);
    }
    load();
  }, [id]);

  if (authed === null) return null;

  if (authed === false) {
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Members only</span>
        <h1 style={{ fontSize: 32, margin: '14px 0 16px' }}>Log in to view this listing</h1>
        <a href="/login" className="btn btn-primary" style={{ marginRight: 10 }}>Log in</a>
        <a href="/signup" className="btn btn-outline">Create an account</a>
      </main>
    );
  }

  if (!listing) {
    return <main className="plain-surface container" style={{ padding: 56 }}>Loading...</main>;
  }

  return (
    <main className="plain-surface" style={{ minHeight: '60vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 720 }}>
        <span className="eyebrow">Job listing</span>
        <h1 style={{ fontSize: 34, margin: '10px 0 6px' }}>{listing.title}</h1>
        <p className="meta" style={{ marginBottom: 20 }}>
          Posted by {listing.profiles?.full_name || 'A client'}
          {' · '}
          <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <MessageButton otherUserId={listing.client_id} label="Message client" />
          </span>
        </p>

        {listing.budget_cents && (
          <p className="rate" style={{ fontSize: 18, marginBottom: 20 }}>
            ${(listing.budget_cents / 100).toLocaleString()}
          </p>
        )}

        <p style={{ color: 'var(--slate)', fontSize: 17, lineHeight: 1.8, marginBottom: 24 }}>
          {listing.description}
        </p>

        <div style={{ marginBottom: 32 }}>
          {listing.skills?.map((s) => (
            <span className="skill-tag" key={s}>{s}</span>
          ))}
        </div>

        <ApplyBox listingId={listing.id} clientId={listing.client_id} />
        <ApplicantsList listingId={listing.id} clientId={listing.client_id} />
      </div>
    </main>
  );
}        <ApplyBox listingId={listing.id} clientId={listing.client_id} />
        <ApplicantsList listingId={listing.id} clientId={listing.client_id} />
      </div>
    </main>
  );
}
