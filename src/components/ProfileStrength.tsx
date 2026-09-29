import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SITE } from '@/lib/email';

/** Profile strength checklist + invite card for the member dashboard. */
export default async function ProfileStrength({ userId }: { userId: string }) {
  const supabase = createClient();
  const [{ data: p }, { data: v }, { count: svc }, { count: exp }, { count: skills }, { count: resumes }, { count: invited }] = await Promise.all([
    supabase.from('profiles').select('avatar_url, headline, username').eq('id', userId).maybeSingle(),
    supabase.from('veteran_profiles').select('about, state, verification_status, desired_titles, pro_granted_until').eq('profile_id', userId).maybeSingle(),
    supabase.from('military_service').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
    supabase.from('experience').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
    supabase.from('profile_skills').select('skill_id', { count: 'exact', head: true }).eq('profile_id', userId),
    supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', userId),
  ]);
  const items: [boolean, string, string][] = [
    [v?.verification_status === 'verified', 'Get verified', '/dashboard/verification'],
    [!!p?.avatar_url, 'Add a profile photo', '/settings/account'],
    [!!p?.headline, 'Write a headline', '/dashboard/profile'],
    [!!v?.about, 'Add an About summary', '/dashboard/profile'],
    [(svc ?? 0) > 0, 'Add your military service', '/dashboard/profile'],
    [(exp ?? 0) > 0, 'Add civilian work history (if any)', '/dashboard/profile'],
    [(skills ?? 0) >= 5, 'List at least 5 skills', '/dashboard/profile'],
    [((v?.desired_titles as string[] | null) ?? []).length > 0, 'Add the roles you want next', '/dashboard/profile'],
    [!!v?.state, 'Add your state', '/dashboard/profile'],
    [(resumes ?? 0) > 0, 'Upload a résumé', '/dashboard/profile'],
  ];
  const done = items.filter(([ok]) => ok).length;
  const pct = Math.round((done / items.length) * 100);
  const link = p?.username ? `${SITE}/signup?ref=${p.username}` : null;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card p-6">
        <div className="flex items-center justify-between"><p className="eyebrow">Profile strength</p><span className="font-serif text-2xl text-navy">{pct}%</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} /></div>
        {pct < 100 ? (
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {items.filter(([ok]) => !ok).slice(0, 6).map(([, label, href]) => <li key={label}><Link href={href} className="text-navy hover:underline">○ {label}</Link></li>)}
          </ul>
        ) : <p className="mt-3 text-sm text-olive">✓ All-star profile — employers see complete profiles first, and your job matches are at their best.</p>}
        <p className="mt-3 text-xs text-muted">Complete profiles get more employer views and better job matches.</p>
      </section>
      <section className="card p-6">
        <p className="eyebrow">Invite fellow service members</p>
        <p className="mt-2 text-sm text-muted">On a paid plan, earn a free month of your plan for each service member you invite once they’re verified and finish their profile — up to 3 free months a year.</p>
        {link && <input readOnly value={link} className="field mt-3 text-xs" aria-label="Your invite link for service members" />}
        <p className="mt-3 text-sm text-muted"><strong className="text-navy">Bring an employer:</strong> when a company you invite is verified and makes its first payment, you get 2 free months of Pro Plus — or 2 free months of Federal if you’re on Federal.</p>
        {p?.username && <input readOnly value={`${SITE}/signup?role=employer&ref=${p.username}`} className="field mt-2 text-xs" aria-label="Your invite link for employers" />}
        <p className="mt-2 text-xs text-muted">{invited ?? 0} joined with your link{v?.pro_granted_until && Date.parse(v.pro_granted_until as string) > Date.now() ? ` · Free Pro through ${new Date(v.pro_granted_until as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
      </section>
    </div>
  );
}
