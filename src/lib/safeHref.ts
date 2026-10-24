/** Only ever link to web addresses a member typed (never "javascript:" or other schemes). */
export function safeHref(url: string | null | undefined) {
  const u = (url ?? '').trim();
  return /^https?:\/\/[^\s]+$/i.test(u) ? u : undefined;
}
