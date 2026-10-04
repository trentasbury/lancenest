import type { Metadata } from 'next';

export const metadata: Metadata = { alternates: { canonical: '/accessibility' }, title: 'Accessibility', description: 'LanceNest’s commitment to an accessible site for every service member and veteran.' };

export default function AccessibilityPage() {
  return (
    <article className="container-page max-w-3xl space-y-6 py-14 text-[16px] leading-relaxed text-ink/90">
      <h1 className="font-serif text-4xl font-medium">Accessibility</h1>
      <p>LanceNest is built for every service member and veteran, including those with disabilities. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA, and we test with keyboards, screen readers, and mobile devices as the site grows.</p>
      <p>If anything on LanceNest is hard to use — a form, a document upload, a payment, or a message — please tell us at <a href="mailto:support@lancenest.com?subject=Accessibility" className="text-navy underline">support@lancenest.com</a> with “Accessibility” in the subject. We’ll respond within two business days and help you complete what you were doing.</p>
    </article>
  );
}
