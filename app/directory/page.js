import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const revalidate = 60;

export default async function Directory() {
  const { data: freelancers } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, headline, skills, hourly_rate, avatar_url, is_pro')
    .eq('role', 'freelancer')
    .order('is_pro', { ascending: false })
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h3 style={{ margin: 0 }}>{f.full_name}</h3>
              {f.is_pro && (
                <span
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 9,
                    letterSpacing: '0.06em',
                    color: 'var(--ink)',
                    background: 'var(--gold)',
                    padding: '2px 6px',
                  }}
                >
                  PRO
                </span>
              )}
            </div>
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
