/**
 * Which "apply on company site" links a job may use. The database enforces the same rule
 * (private.check_apply_url); this copy lets the job form explain a problem before saving.
 */
export const ATS_HOSTS = /(^|\.)(myworkdayjobs\.com|myworkdaysite\.com|greenhouse\.io|lever\.co|icims\.com|smartrecruiters\.com|jobvite\.com|taleo\.net|ashbyhq\.com|bamboohr\.com|workable\.com|paylocity\.com|adp\.com|ultipro\.com|ukg\.com|successfactors\.com|oraclecloud\.com|applytojob\.com|breezy\.hr|jazzhr\.com|clearcompany\.com)$/;

/** The company's verified website host (no "www."), or null. */
export function siteHost(website: unknown): string | null {
  if (typeof website !== 'string' || !website) return null;
  try { return new URL(website).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

/** Why a link can't be used, or null when it's fine. */
export function applyLinkProblem(url: string, verifiedHost: string | null): string | null {
  let host: string;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') return 'Use a secure link that starts with https://';
    host = u.hostname.toLowerCase();
  } catch {
    return 'Enter the full link, starting with https://';
  }
  if (verifiedHost && (host === verifiedHost || host.endsWith(`.${verifiedHost}`))) return null;
  if (ATS_HOSTS.test(host)) return null;
  return verifiedHost
    ? `Use a link on ${verifiedHost} (for example careers.${verifiedHost}) or a standard applicant-tracking system such as Workday, Greenhouse, Lever or iCIMS.`
    : 'Until your company website is verified, use a link from a standard applicant-tracking system such as Workday, Greenhouse, Lever or iCIMS.';
}
