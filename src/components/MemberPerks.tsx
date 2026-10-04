import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PlanBadge from '@/components/PlanBadge';
import { boostProfile } from '@/app/dashboard/actions';

/** Member perks on the dashboard: who viewed your profile (Pro+) and profile boosts (Career Accelerator+). */
export default async function MemberPerks({ userId, boost }: { userId: string; boost?: string }) {
  const user = { id: userId };
  const searchParams = { boost };

          const supabase = createClient();
          const [{ data: me }, { data: views30 }] = await Promise.all([
            supabase.from('veteran_profiles').select('plan, boosted_until').eq('profile_id', user.id).maybeSingle(),
            supabase.rpc('my_profile_view_count', { days: 30 }),
          ]);
          const plan = (me?.plan as string) ?? 'free';
          const paid = plan !== 'free';
          const { data: viewers } = paid
            ? await supabase.from('profile_views').select('viewed_at, viewer:profiles!profile_views_viewer_id_fkey(full_name, username, headline, role)').eq('profile_id', user.id).order('viewed_at', { ascending: false }).limit(6)
            : { data: [] };
          const boosted = me?.boosted_until && new Date(me.boosted_until as string) > new Date();
          return (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <section className="card p-6">
                <div className="flex items-center justify-between"><p className="eyebrow">Who viewed your profile</p><PlanBadge plan={plan} /></div>
                <p className="mt-2 font-serif text-3xl text-navy">{(views30 as number) ?? 0} <span className="text-base text-muted">views in the last 30 days</span></p>
                {paid ? (
                  (viewers ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">No views yet — a complete profile and résumé help employers find you.</p> : (
                    <ul className="mt-3 divide-y divide-line text-sm">
                      {((viewers ?? []) as unknown as { viewed_at: string; viewer: { full_name: string; username: string | null; headline: string | null; role: string } | null }[]).map((v, i) => (
                        <li key={i} className="flex justify-between gap-3 py-2">
                          <span className="truncate">{v.viewer?.role === 'veteran' && v.viewer.username ? <Link href={`/veterans/${v.viewer.username}`} className="text-navy hover:underline">{v.viewer.full_name}</Link> : v.viewer?.full_name ?? 'A member'}
                            {v.viewer?.role === 'employer' && <span className="ml-1.5 text-xs text-olive">· Employer</span>}<span className="block truncate text-xs text-muted">{v.viewer?.headline}</span></span>
                          <span className="shrink-0 text-xs text-muted">{new Date(v.viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : <p className="mt-2 text-sm text-muted">See exactly who — including which employers — with <Link href="/plans" className="text-navy underline">Pro</Link>.</p>}
              </section>
              <section className="card p-6">
                <p className="eyebrow">Profile boost</p>
                {['pro_plus', 'federal_pro'].includes(plan) ? (
                  boosted ? <p className="mt-2 text-sm text-olive">✓ Boosted — you’re featured at the top of employer searches until {new Date(me!.boosted_until as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p> : (
                    <form action={boostProfile} className="mt-2 space-y-2">
                      <p className="text-sm text-muted">Be featured at the top of employer searches for 7 days. 2 boosts each month.</p>
                      {searchParams.boost === 'used' && <p className="text-sm text-signal">You’ve used both boosts this month.</p>}
                      <button className="btn btn-brass w-full">Boost my profile</button>
                    </form>
                  )
                ) : <p className="mt-2 text-sm text-muted">Get featured at the top of employer searches with <Link href="/plans" className="text-navy underline">Career Accelerator</Link>.</p>}
              </section>
            </div>
          );
}
