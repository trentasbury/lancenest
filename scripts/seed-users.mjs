// Creates development demo accounts + 9 fictional veteran profiles.
// Usage (local only):  npm run seed:users
// Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD
// Run supabase/seed.sql FIRST (the demo employer is attached to a seed company).
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DEMO_PASSWORD in .env.local');
  process.exit(1);
}
if (password.length < 12) {
  console.error('DEMO_PASSWORD must be at least 12 characters.');
  process.exit(1);
}
if (/lancenest\.com/.test(process.env.NEXT_PUBLIC_SITE_URL ?? '')) {
  console.error('Refusing to seed demo accounts while NEXT_PUBLIC_SITE_URL points at production.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const veterans = [
  { name: 'Jordan Hale', branch: 'Army', code: '11B', rank: 'SSG', city: 'Fayetteville', state: 'NC', years: 8, deployments: 2, headline: 'Operations leader · Infantry veteran' },
  { name: 'Avery Collins', branch: 'Navy', code: 'LS', rank: 'LS1', city: 'Norfolk', state: 'VA', years: 6, deployments: 3, headline: 'Supply chain & logistics' },
  { name: 'Riley Santos', branch: 'Air Force', code: '3P0X1', rank: 'TSgt', city: 'San Antonio', state: 'TX', years: 10, deployments: 2, headline: 'Security operations manager' },
  { name: 'Quinn Mercer', branch: 'Marine Corps', code: '0311', rank: 'Sgt', city: 'Jacksonville', state: 'NC', years: 5, deployments: 1, headline: 'Team leader · Project coordination' },
  { name: 'Taylor Brooks', branch: 'Army', code: '25B', rank: 'SGT', city: 'Killeen', state: 'TX', years: 6, deployments: 1, headline: 'IT systems & network support' },
  { name: 'Parker Lane', branch: 'Navy', code: 'HM', rank: 'HM2', city: 'San Diego', state: 'CA', years: 7, deployments: 2, headline: 'Clinical operations · Corpsman' },
  { name: 'Emerson Cole', branch: 'Coast Guard', code: 'BM', rank: 'BM1', city: 'Portsmouth', state: 'VA', years: 12, deployments: 0, headline: 'Marine operations & safety' },
  { name: 'Hayden Price', branch: 'Army', code: '35F', rank: 'SSG', city: 'Colorado Springs', state: 'CO', years: 9, deployments: 3, headline: 'Intelligence & data analysis' },
  { name: 'Rowan Ellis', branch: 'Air Force', code: '2T2X1', rank: 'SSgt', city: 'Dover', state: 'DE', years: 6, deployments: 1, headline: 'Air transportation & logistics' },
  { name: 'Sawyer Grant', branch: 'Marine Corps', code: '3531', rank: 'Cpl', city: 'Oceanside', state: 'CA', years: 4, deployments: 1, headline: 'Fleet & transportation operations' },
];

const accounts = [
  { email: 'demo-veteran@lancenest.local', role: 'veteran', vet: veterans[0] },
  { email: 'demo-employer@lancenest.local', role: 'employer', name: 'Morgan Reyes' },
  { email: 'demo-admin@lancenest.local', role: 'admin', name: 'Casey Whitfield' },
  ...veterans.slice(1).map((vet, i) => ({ email: `veteran${i + 1}@lancenest.local`, role: 'veteran', vet })),
];

async function findUserId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

for (const acct of accounts) {
  const fullName = acct.vet?.name ?? acct.name;
  // Signup metadata can only ever produce 'veteran' or 'employer'; admin is granted below.
  const signupRole = acct.role === 'employer' ? 'employer' : 'veteran';

  let userId = await findUserId(acct.email);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: acct.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: signupRole },
    });
    if (error) {
      console.error(`✗ ${acct.email}: ${error.message}`);
      continue;
    }
    userId = data.user.id;
    console.log(`✓ created ${acct.email}`);
  } else {
    console.log(`• exists  ${acct.email}`);
  }

  if (acct.role === 'admin') {
    await admin.from('profiles').update({ role: 'admin' }).eq('id', userId);
    await admin.from('veteran_profiles').delete().eq('profile_id', userId);
  }

  if (acct.role === 'employer') {
    await admin.from('companies').update({ owner_id: userId }).eq('slug', 'harborline-defense-group');
  }

  if (acct.vet) {
    const v = acct.vet;
    await admin.from('profiles').update({ headline: v.headline, location: `${v.city}, ${v.state}`, onboarding_completed: true }).eq('id', userId);
    await admin.from('veteran_profiles').update({
      about: `${v.branch} veteran with ${v.years} years of service. (Fictional demo profile.)`,
      city: v.city,
      state: v.state,
      is_public: true,
      verification_status: 'verified',
    }).eq('profile_id', userId);

    const { data: occ } = await admin.from('military_occupations').select('id').eq('code', v.code).eq('branch', v.branch).maybeSingle();
    const { count } = await admin.from('military_service').select('id', { count: 'exact', head: true }).eq('profile_id', userId);
    if (!count) {
      await admin.from('military_service').insert({
        profile_id: userId,
        branch: v.branch,
        rank: v.rank,
        occupation_code: v.code,
        occupation_id: occ?.id ?? null,
        deployments: v.deployments,
        start_date: `${2024 - v.years}-06-01`,
        end_date: '2024-06-01',
      });
    }
  }
}

// ---------- Network demo activity (fictional) ----------
const { data: people } = await admin.from('profiles').select('id, full_name').like('username', '%').in('role', ['veteran', 'employer']);
const byName = Object.fromEntries((people ?? []).map((p) => [p.full_name, p.id]));
const id = (name) => byName[name];
const { count: existingPosts } = await admin.from('network_posts').select('id', { count: 'exact', head: true });

if (!existingPosts) {
  const names = veterans.map((v) => v.name).filter((n) => id(n));
  // Everyone follows the next three people; the first two follow each other (a "connection").
  const follows = [];
  names.forEach((n, i) => [1, 2, 3].forEach((k) => follows.push({ follower_id: id(n), following_id: id(names[(i + k) % names.length]) })));
  follows.push({ follower_id: id(names[1]), following_id: id(names[0]) });
  await admin.from('user_follows').upsert(follows, { ignoreDuplicates: true });

  const posts = [
    [names[0], 'career', 'new_job', 'Started a new position as Operations Manager at Anchor & Oak Logistics', 'Eight years of leading Soldiers translated into leading a 40-person warehouse team. Grateful for everyone who helped me make the jump.', 'Operations Manager', 'Anchor & Oak Logistics'],
    [names[1], 'certification', 'certification', 'Earned the PMP certification from PMI', 'Studied on nights and weekends for four months. The Navy taught me the discipline — PMI gave me the vocabulary.', 'PMP', 'PMI'],
    [names[2], 'military', 'military_retirement', 'Retired from the U.S. Air Force after 20 years of service', 'Twenty years, six bases, one incredible family. Next chapter: corporate security leadership.', 'TSgt', 'U.S. Air Force'],
    [names[3], 'career', 'promotion', 'Was promoted to Director of Operations at Brass Compass Consulting', null, 'Director of Operations', 'Brass Compass Consulting'],
    [names[4], 'education', 'graduation', 'Graduated with a B.S. in Cybersecurity from Old Dominion University', 'Used every bit of my GI Bill. Worth it.', 'B.S. in Cybersecurity', 'Old Dominion University'],
    [names[5], 'business', 'new_business', 'Launched Tidewater Medical Staffing', 'Veteran-owned and hiring corpsmen and medics first.', null, 'Tidewater Medical Staffing'],
    [names[6], 'accomplishment', 'award', 'Received the Coast Guard Achievement Medal', null, 'Coast Guard Achievement Medal', null],
    [names[7], 'career', 'career_transition', 'Transitioned into a new role as Data Analyst at Summit Line Cyber', 'Intelligence analysis → data analysis. Same instincts, new tools.', 'Data Analyst', 'Summit Line Cyber'],
    [names[8], 'general', null, null, 'Just finished my first week on a SkillBridge internship. If you’re within 180 days of separation, ask your command about it — it changed my transition.', null, null],
  ].filter((p) => id(p[0]));

  const { data: created } = await admin.from('network_posts').insert(posts.map(([name, post_type, milestone, headline, body, title, organization], i) => ({
    author_id: id(name), post_type, milestone, headline, body: body ?? '', title, organization, visibility: 'network',
    created_at: new Date(Date.now() - i * 5 * 3600_000).toISOString(),
  }))).select('id, author_id');

  const reactions = ['congratulations', 'proud', 'support', 'well_done', 'inspiring', 'thank_you'];
  const reactRows = [];
  const commentRows = [];
  (created ?? []).forEach((post, i) => {
    names.filter((n) => id(n) !== post.author_id).slice(0, 3 + (i % 4)).forEach((n, k) => reactRows.push({ post_id: post.id, profile_id: id(n), reaction: reactions[(i + k) % reactions.length] }));
    const commenter = names.find((n) => id(n) !== post.author_id);
    commentRows.push({ post_id: post.id, author_id: id(commenter), body: ['Congratulations — well deserved.', 'This is huge. Proud of you.', 'Great example for everyone still transitioning.'][i % 3] });
  });
  await admin.from('post_reactions').insert(reactRows);
  await admin.from('post_comments').insert(commentRows);
  console.log(`✓ network: ${created?.length ?? 0} posts, ${reactRows.length} reactions, ${commentRows.length} comments, ${follows.length} follows`);
} else {
  console.log('• network activity already seeded');
}

console.log('\nDone. Sign in with any account above using DEMO_PASSWORD.');
