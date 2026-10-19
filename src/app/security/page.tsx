import type { Metadata } from 'next';

export const metadata: Metadata = { alternates: { canonical: '/security' }, title: 'Security', description: 'How LanceNest protects members, employers, and their data.' };

export default function SecurityPage() {
  const S = ({ h, children }: { h: string; children: React.ReactNode }) => <section><h2 className="font-serif text-2xl text-navy">{h}</h2><div className="mt-2 space-y-2">{children}</div></section>;
  return (
    <article className="container-page max-w-3xl space-y-8 py-14 text-[16px] leading-relaxed text-ink/90">
      <h1 className="font-serif text-4xl font-medium">Security at LanceNest</h1>
      <S h="Data boundary"><p>LanceNest does not accept or process classified information, Controlled Unclassified Information (CUI), Federal Contract Information (FCI), export-controlled data, government system credentials, or security clearance records. Clearance information on profiles is self-reported and is not verified by LanceNest.</p></S>
      <S h="Verification documents"><p>Service documents and the matching photo ID go straight from the member’s browser into private, access-restricted storage. An authorized reviewer, signed in with two-step login, opens them through links that expire after 10 minutes, and every opening is recorded in an access log. The reviewer compares them by eye (no face-matching software), and both are deleted as soon as the reviewer approves or rejects them. Files that are never reviewed are deleted automatically after 30 days, and uploads never submitted for review are deleted within 48 hours. Military and VA ID cards and clearance records are never accepted.</p></S>
      <S h="Access and accounts"><p>Data is encrypted in transit (TLS) and at rest by our infrastructure providers. Database-level access rules govern every table. Administrator access requires two-step verification. Sessions expire after 30 minutes of inactivity, and members are alerted to sign-ins from new devices.</p></S>
      <S h="Payments"><p>Card and bank payments are processed by Stripe; LanceNest never stores card numbers. Freelance milestone payments are held and released through Stripe Connect.</p></S>
      <S h="Providers"><p>We use established providers for hosting (Vercel), database and storage (Supabase), payments (Stripe), email (Resend), and bot protection (Cloudflare Turnstile).</p></S>
      <S h="Report a concern"><p>Found a vulnerability or a security issue? Email <a href="mailto:support@lancenest.com?subject=Security" className="text-navy underline">support@lancenest.com</a> with “Security” in the subject. We review every report.</p></S>
    </article>
  );
}
