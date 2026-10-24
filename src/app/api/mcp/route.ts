import { NextResponse, type NextRequest } from 'next/server';
import { allPublicJobs, filterPublicJobs, getPublicJob } from '@/lib/publicJobs';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { formatSalary } from '@/lib/format';

/**
 * A read-only MCP server (Streamable HTTP, JSON responses) so people can search LanceNest's public jobs from AI
 * assistants such as ChatGPT, Claude and Gemini. It serves exactly what /open-jobs shows: verified employers' public
 * jobs, with the employer kept confidential and contact details removed. Applying still happens on LanceNest.
 */
export const dynamic = 'force-dynamic';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const TOOLS = [
  {
    name: 'search_jobs',
    description: 'Search open jobs from employers verified by LanceNest, for U.S. service members, veterans and military spouses. Employer names are confidential; every job shows pay. Returns up to 20 jobs with links to apply on LanceNest.',
    inputSchema: { type: 'object', properties: {
      query: { type: 'string', description: 'Job title or keywords, e.g. "logistics" or "cyber analyst"' },
      state: { type: 'string', description: 'Two-letter U.S. state code, e.g. "VA". Remote jobs are included.' },
      remote_only: { type: 'boolean', description: 'Only remote jobs' },
      clearance: { type: 'string', enum: ['required', 'none'], description: 'Clearance required, or no clearance needed' },
      min_pay: { type: 'number', description: 'Minimum yearly pay in U.S. dollars' },
    } },
  },
  {
    name: 'get_job',
    description: 'Full details of one LanceNest job by its slug (from search_jobs).',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
];

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const reply = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const text = (value: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.slice(0, max) : undefined);

async function call(name: string, args: Record<string, unknown>) {
  if (name === 'search_jobs') {
    const pay = typeof args.min_pay === 'number' && args.min_pay > 0 ? String(Math.round(args.min_pay)) : undefined;
    const matches = filterPublicJobs(await allPublicJobs(), {
      q: str(args.query), where: args.remote_only === true ? 'remote' : str(args.state, 2), clearance: str(args.clearance, 10), pay,
    }).slice(0, 20);
    return text({
      results: matches.map(({ job }) => ({
        title: job.title, employer: 'Verified employer (confidential)', location: job.work_arrangement === 'remote' ? 'Remote (U.S.)' : job.location,
        pay: formatSalary(job.salary_min, job.salary_max, job.salary_period), clearance_required: job.clearance_required !== 'none',
        posted: job.posted_at.slice(0, 10), slug: job.slug, url: `${CANONICAL_ORIGIN}/open-jobs/${job.slug}`,
      })),
      note: 'Applying needs a free, verified LanceNest account. Employer names are shown to verified members.',
    });
  }
  if (name === 'get_job') {
    const job = await getPublicJob(str(args.slug, 160) ?? '');
    if (!job) return { ...text({ error: 'No open public job with that slug.' }), isError: true };
    return text({
      title: job.title, employer: 'Verified employer (confidential)', location: job.work_arrangement === 'remote' ? 'Remote (U.S.)' : job.location,
      pay: formatSalary(job.salary_min, job.salary_max, job.salary_period), employment_type: job.employment_type, clearance_required: job.clearance_required,
      description: job.description, responsibilities: job.responsibilities, qualifications: job.qualifications, benefits: job.benefits,
      apply: `${CANONICAL_ORIGIN}/open-jobs/${job.slug}`,
    });
  }
  return null;
}

async function handle(msg: Rpc) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid request');
  const isNotification = msg.id === undefined || msg.id === null;
  switch (msg.method) {
    case 'initialize': {
      const asked = str(msg.params?.protocolVersion, 20);
      return reply(msg.id, {
        protocolVersion: asked && VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'lancenest-jobs', title: 'LanceNest public jobs', version: '1.0.0' },
        instructions: 'Search open jobs from verified employers hiring U.S. service members, veterans and military spouses. Link people to the job URL to apply on LanceNest.',
      });
    }
    case 'ping': return reply(msg.id, {});
    case 'tools/list': return reply(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = str(msg.params?.name, 40) ?? '';
      const args = (msg.params?.arguments && typeof msg.params.arguments === 'object' ? msg.params.arguments : {}) as Record<string, unknown>;
      const result = await call(name, args);
      return result ? reply(msg.id, result) : fail(msg.id, -32602, `Unknown tool: ${name}`);
    }
    default:
      return isNotification ? null : fail(msg.id, -32601, 'Method not found');
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 20000) return NextResponse.json(fail(null, -32600, 'Request too large'), { status: 413 });
  let body: Rpc | Rpc[];
  try { body = JSON.parse(raw) as Rpc | Rpc[]; } catch { return NextResponse.json(fail(null, -32700, 'Parse error'), { status: 400 }); }
  const batch = Array.isArray(body) ? body.slice(0, 10) : [body];
  const out = (await Promise.all(batch.map(handle))).filter(Boolean);
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0], { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  return new NextResponse('LanceNest MCP server: send JSON-RPC requests with POST.', { status: 405, headers: { Allow: 'POST' } });
}
