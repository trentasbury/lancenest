/** Wording that shows up in employment scams. "block" stops a job from publishing; "warn" flags a message. */
const PATTERNS: { re: RegExp; label: string; level: 'block' | 'warn' }[] = [
  { re: /\b(application|training|registration|onboarding|processing|placement|starter kit|background[- ]check)\s+(fee|cost|payment)s?\b/i, label: 'asks for a fee', level: 'block' },
  { re: /\b(you|candidates?|applicants?|hires?)\b[^.]{0,40}\b(pay|send|wire|deposit)\b[^.]{0,30}\b(fee|money|funds|\$\d+)/i, label: 'asks you to send money', level: 'block' },
  { re: /\bgift ?cards?\b/i, label: 'mentions gift cards', level: 'block' },
  { re: /\b(bitcoin|crypto(currency)?|usdt|western union|moneygram|zelle|cash ?app)\b/i, label: 'mentions crypto or payment apps', level: 'block' },
  { re: /\b(deposit|cash)\b[^.]{0,30}\bchecks?\b|\bchecks?\b[^.]{0,30}\b(deposit|equipment|supplies)\b/i, label: 'mentions depositing a check', level: 'block' },
  { re: /\b(telegram|whats ?app|signal app|wickr|google chat|hangouts)\b/i, label: 'moves the conversation to another app', level: 'block' },
  { re: /\b(buy|purchase)\b[^.]{0,25}\b(laptop|equipment|software|supplies)\b[^.]{0,40}\b(reimburs|refund)/i, label: 'asks you to buy equipment for reimbursement', level: 'block' },
  { re: /\b(social security|ssn)\b/i, label: 'asks for a Social Security number', level: 'warn' },
  { re: /\b(bank|routing|checking) (account|number|details|info)/i, label: 'asks for bank details', level: 'warn' },
  { re: /\b(driver'?s licen[cs]e|passport)\b[^.]{0,30}\b(photo|picture|copy|scan|send)\b/i, label: 'asks for ID documents', level: 'warn' },
];

export function scamSignals(text: string, level: 'block' | 'all' = 'all') {
  return PATTERNS.filter((p) => (level === 'all' || p.level === 'block') && p.re.test(text)).map((p) => p.label);
}
