export const SKILLBRIDGE_DAYS = 180;

export function transitionTimeline(separation: string | null) {
  if (!separation) return null;
  const sep = new Date(`${separation}T12:00:00`);
  const today = new Date();
  const days = Math.ceil((sep.getTime() - today.getTime()) / 86400000);
  const windowOpens = new Date(sep.getTime() - SKILLBRIDGE_DAYS * 86400000);
  const phase = days < 0 ? 'separated' : days <= SKILLBRIDGE_DAYS ? 'window_open' : days <= 365 ? 'plan_now' : 'early';
  return { days, windowOpens, sep, phase };
}

export const OFFICIAL = {
  skillbridge: 'https://skillbridge.osd.mil/',
  tap: 'https://www.dodtap.mil/',
  vaBenefits: 'https://www.va.gov/',
  giBill: 'https://www.va.gov/education/gi-bill-comparison-tool/',
};
