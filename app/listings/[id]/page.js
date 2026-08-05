import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import ApplyBox from './ApplyBox';
import ApplicantsList from './ApplicantsList';

export default async function ListingDetail({ params }) {
  const { id } = params;

  const { data: listing } = await supabaseAdmin
    .from('job_listings')
    .select('*, profiles(full_name, id)')
    .eq('id', id)
    .single();

  if (!listing) {
    return <main className="plain-surface container" style={{ padding: 56 }}>Listing not found.</main>;
  }

  return (
    <main className="plain-surface" style={{ minHeight: '60vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 720 }}>
        <span className="eyebrow">Job listing</span>
        <h1 style={{ fontSize: 34, margin: '10px 0 6px' }}>{listing.title}</h1>
        <p className="meta" style={{ marginBottom: 20 }}>Posted by {listing.profiles?.full_name || 'A client'}</p>

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
}
