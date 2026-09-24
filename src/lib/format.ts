import type { ClearanceLevel, EmploymentType, WorkArrangement } from '@/lib/types';

export const ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  skillbridge: 'SkillBridge',
};

export const CLEARANCE_LABELS: Record<ClearanceLevel, string> = {
  none: 'None',
  public_trust: 'Public Trust',
  confidential: 'Confidential',
  secret: 'Secret',
  top_secret: 'Top Secret',
  ts_sci: 'TS/SCI',
};

export function formatSalary(min: number | null, max: number | null, period: 'year' | 'hour' = 'year'): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    period === 'hour' ? `$${n.toFixed(0)}` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;
  const suffix = period === 'hour' ? '/hr' : '';
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}${suffix}`;
  return `${min != null ? 'From ' + fmt(min) : 'Up to ' + fmt(max as number)}${suffix}`;
}

export function postedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return `Posted ${months} month${months > 1 ? 's' : ''} ago`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Strip characters that would break a PostgREST or() filter. */
export function sanitizeSearch(value: string): string {
  return value.replace(/[,()%*\\]/g, ' ').trim().slice(0, 80);
}
