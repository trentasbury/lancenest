// Shared by the Help page, its form handler, and the admin queue.
export const KINDS = [
  ['support', 'I need help', 'A question about your account, verification, billing, or jobs.'],
  ['bug', 'Something’s broken', 'A page, button, or email isn’t working the way it should.'],
  ['idea', 'I have an idea', 'A feature or change that would make LanceNest better.'],
] as const;

export type Kind = (typeof KINDS)[number][0];
export const KIND_LABEL: Record<string, string> = { support: 'Help request', bug: 'Bug report', idea: 'Idea' };

export const STATUSES = [
  ['new', 'Received'], ['in_progress', 'Looking into it'], ['planned', 'Planned'], ['done', 'Done'], ['closed', 'Closed'],
] as const;
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES);
