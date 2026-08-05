import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const revalidate = 60;

export default async function Directory() {
  const { data: freelancers } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, headline, skills, hourly_rate, avatar_url')
    .eq('role', 'freelancer')
    .order('created_at', { ascending: false });

  return (
    <main>
      <div className="section-title" style={{ paddingTop: 32 }}>Find talent</div>
      {(!freelancers || freelancers.length === 0) && (
        <div className="empty">No freelancers yet — be the first to create a profile.</div>
      )}
      <div className="grid">
        {freelancers?.map((f) => (
          <a href={`/profile/${f.id}`} key={f.id} className="card">
            <h3>{f.full_name}</h3>
            <p className="meta">{f.headline || 'Freelancer on LanceNest'}</p>
            {f.hourly_rate && <p className="rate">${f.hourly_rate}/hr</p>}
            <div style={{ marginTop: 10 }}>
              {f.skills?.slice(0, 4).map((s) => (
                <span className="skill-tag" key={s}>{s}</span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
