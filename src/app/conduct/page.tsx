import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Code of Conduct' };

export default function ConductPage() {
  return (
    <LegalPage title="Code of Conduct" updated="September 2026">
      <section><p>LanceNest is a professional network for verified service members and the companies that hire them. Conduct yourself the way you would in uniform and in an interview: with respect, honesty, and discretion.</p></section>
      <section>
        <h2>Expected of every member</h2>
        <ul>
          <li>Treat every member with respect, regardless of rank, branch, background, or opinion.</li>
          <li>Be truthful about your service, experience, clearance, and company.</li>
          <li>Keep messages professional. No harassment, threats, slurs, sexual content, or unwanted advances.</li>
          <li>No spam, scams, pyramid schemes, or requests for money or personal financial information.</li>
          <li>Never share classified information or Controlled Unclassified Information (CUI).</li>
          <li>Employers: post only real, lawful roles and never charge candidates.</li>
          <li>Freelancers and clients: keep work and payments on LanceNest and honor your agreements.</li>
        </ul>
      </section>
      <section>
        <h2>How we enforce it</h2>
        <p>Members can report any profile, post, comment, message, or job. Every report is reviewed by a person, and every action is logged with the reason.</p>
        <ul>
          <li><strong>Strike 1 — Warning.</strong> You’ll be told what happened and why.</li>
          <li><strong>Strike 2 — 7-day suspension.</strong> You can’t use LanceNest during the suspension.</li>
          <li><strong>Strike 3 — Removal.</strong> Your account is permanently removed.</li>
        </ul>
        <p>Serious violations — threats, harassment, fraud, impersonation, or sharing classified information — can lead to immediate removal. You can see your own conduct record in Account settings, and you can appeal any action by emailing <a className="text-navy underline" href="mailto:support@lancenest.com">support@lancenest.com</a> within 30 days.</p>
      </section>
    </LegalPage>
  );
}
