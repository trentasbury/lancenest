export type Role = 'veteran' | 'employer' | 'admin';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  username: string | null;
  headline: string | null;
  avatar_url: string | null;
  location: string | null;
  onboarding_completed: boolean;
  suspended_until?: string | null;
  banned?: boolean;
};

export type WorkArrangement = 'remote' | 'hybrid' | 'onsite';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'skillbridge';
export type ClearanceLevel = 'none' | 'public_trust' | 'confidential' | 'secret' | 'top_secret' | 'ts_sci';

export type Company = {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  headquarters: string | null;
  website: string | null;
  about: string | null;
  mission: string | null;
  benefits: string | null;
  veteran_commitment: string | null;
  is_verified: boolean;
  plan: 'free' | 'starter' | 'professional' | 'federal' | 'enterprise';
  extra_job_slots?: number;
  msep_status?: 'none' | 'pending' | 'verified' | 'rejected';
  guard_reserve_pledge?: boolean;
};

export type Job = {
  id: string;
  company_id: string;
  external_source?: string | null;
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  work_arrangement: WorkArrangement;
  employment_type: EmploymentType;
  experience_level: 'entry' | 'mid' | 'senior' | 'executive' | null;
  industry: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: 'year' | 'hour';
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  preferred_qualifications: string | null;
  benefits: string | null;
  veteran_preferred: boolean;
  military_transferable: boolean;
  clearance_required: ClearanceLevel;
  clearance_eligible: boolean;
  status: 'draft' | 'open' | 'paused' | 'closed';
  featured_until?: string | null;
  apply_url?: string | null;
  /** How veterans apply: Easy Apply on LanceNest, the company's own site, or either. */
  apply_mode?: 'easy' | 'external' | 'both';
  posted_at: string;
};

export type JobWithCompany = Job & {
  company: Pick<Company, 'name' | 'slug' | 'logo_url' | 'is_verified' | 'industry'> | null;
};

export type MilitaryOccupation = {
  id: string;
  code: string;
  branch: string;
  title: string;
  civilian_categories: string[];
  civilian_skills: string[];
};
