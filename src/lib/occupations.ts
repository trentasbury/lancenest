import 'server-only';
import data from '@/data/military-occupations.json';
import { createAdminClient } from '@/lib/supabase/admin';

type Occ = { code: string; branch: string; title: string; field: string; categories: string[]; skills: string[] };
let loaded = false;

/**
 * Loads the full military occupation list (≈1,450 codes across five branches) into the database
 * the first time it's needed. Existing rows — including hand-curated ones — are never overwritten.
 */
export async function ensureOccupationsLoaded() {
  if (loaded) return;
  const admin = createAdminClient();
  const { count } = await admin.from('military_occupations').select('id', { count: 'exact', head: true });
  const all = data as Occ[];
  if ((count ?? 0) < all.length) {
    const rows = all.map((o) => ({
      code: o.code, branch: o.branch, title: o.title, description: `Occupational field: ${o.field}`,
      civilian_categories: o.categories, civilian_skills: o.skills,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from('military_occupations').upsert(rows.slice(i, i + 500), { onConflict: 'code,branch', ignoreDuplicates: true });
      if (error) { console.error('occupation import failed:', error.message); return; }
    }
  }
  loaded = true;
}
