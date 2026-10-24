import { CANONICAL_ORIGIN } from '@/lib/seo';

export const revalidate = 86400;

/** A plain-text guide for AI assistants and crawlers (the llms.txt convention). */
export function GET() {
  const o = CANONICAL_ORIGIN;
  const body = `# LanceNest

> LanceNest is a verified career network, job board and freelance marketplace for U.S. service members, veterans and military spouses. Every member's service and every employer is checked by a person.

## Public pages
- [Open jobs](${o}/open-jobs): jobs from verified employers. Employer names are confidential on public pages; every job shows pay. Applying needs a free verified account.
- [Military careers, translated](${o}/careers): 1,469 military jobs (MOS, ratings, AFSCs) mapped to civilian roles, with matching open jobs.
- [Jobs near military bases](${o}/bases)
- [Hire a veteran freelancer](${o}/hire): opt-in public service listings from verified members.
- [Pay insights](${o}/pay): typical posted pay by role and clearance, shown only when 5+ jobs from 3+ employers report it.
- [Virtual career fairs](${o}/fairs)
- [Transition guides](${o}/guides)

## For AI assistants
- MCP server (Streamable HTTP): ${o}/api/mcp with tools search_jobs and get_job. Read-only; serves the same public jobs as /open-jobs.
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
