import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import HireButton from './HireButton';

export default async function Profile({ params }) {
  const { id } = params;

  const [{ data: profile }, { data: portfolio }, { data: reviews }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', id).single(),
    supabaseAdmin.from('portfolio_items').select('*').eq('profile_id', id),
    supabaseAdmin.from('reviews').select('rating, comment, created_at').eq('reviewee_id', id),
  ]);

  if (!profile) {
    return <main className="container" style={{ padding: 48 }}>Profile not found.</main>;
  }

  const avgRating = reviews?.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <main className="container" style={{ padding: '40px 24px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>{profile.full_name}</h1>
      <p style={{ color: '#5b6169', marginBottom: 4 }}>{profile.headline}</p>
      {avgRating && <p style={{ fontSize: 14 }}>★ {avgRating} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})</p>}
      {profile.hourly_rate && <p className="rate" style={{ fontSize: 18, marginTop: 8 }}>${profile.hourly_rate}/hr</p>}

      <div style={{ margin: '16px 0' }}>
        {profile.skills?.map((s) => <span className="skill-tag" key={s}>{s}</span>)}
      </div>

      <p style={{ maxWidth: 600, marginBottom: 24 }}>{profile.bio}</p>

      <HireButton freelancerId={profile.id} freelancerName={profile.full_name} defaultRate={profile.hourly_rate} />

      {portfolio?.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 40 }}>Portfolio</h2>
          <div className="grid" style={{ padding: '16px 0', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))' }}>
            {portfolio.map((p) => (
              <div className="card" key={p.id}>
                <h3>{p.title}</h3>
                <p className="meta">{p.description}</p>
                {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer">View →</a>}
              </div>
            ))}
          </div>
        </>
      )}

      {reviews?.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 32 }}>Reviews</h2>
          {reviews.map((r, i) => (
            <div key={i} style={{ borderTop: '1px solid #dcd9d1', padding: '12px 0' }}>
              <p style={{ fontWeight: 600 }}>★ {r.rating}</p>
              <p>{r.comment}</p>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
