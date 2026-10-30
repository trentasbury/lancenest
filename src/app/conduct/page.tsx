import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { alternates: { canonical: '/conduct' }, title: 'Code of Conduct', description: 'What’s allowed on LanceNest, what isn’t, and how we enforce it.' };

export default function ConductPage() {
  return (
    <LegalPage title="Code of Conduct" updated="October 2026">
      <section><p>LanceNest is a professional community for people who served, their families, and the people who hire them. Conduct yourself the way you would in uniform and in an interview: with respect, honesty, and discretion. These rules cover everything you write or upload here: profiles, posts, comments, messages, jobs, company pages, reviews, freelance projects, proposals and services.</p></section>
      <section>
        <h2>Expected of every member</h2>
        <ul>
          <li>Treat every member with respect, regardless of rank, branch, background, or opinion.</li>
          <li>Be truthful about your service, discharge, experience, clearance, and company.</li>
          <li>Keep it professional. Disagree with ideas, never attack people.</li>
          <li>Employers: post only real, lawful roles with honest pay, and never charge candidates.</li>
          <li>Freelancers and clients: keep work and payments on LanceNest and honor your agreements.</li>
        </ul>
      </section>
      <section>
        <h2>Not allowed, anywhere</h2>
        <ul>
          <li><strong>Sexual content.</strong> Nudity, pornography, sexual images or jokes, links to adult sites, sexual services or “sugar” arrangements, and unwanted advances or comments about anyone’s body. Profile photos must be professional.</li>
          <li><strong>Hate and harassment.</strong> Slurs, attacks on anyone for their race, ethnicity, national origin, religion, sex, sexual orientation, gender identity, disability, age or veteran status, threats, bullying, stalking, or encouraging self-harm.</li>
          <li><strong>Violence and illegal activity.</strong> Glorifying violence, selling weapons, drugs or stolen goods, or helping anyone break the law.</li>
          <li><strong>Scams and spam.</strong> Fake jobs, pyramid or “recruit-your-friends” schemes, requests for money, gift cards, bank details or Social Security numbers, and bulk unsolicited messages.</li>
          <li><strong>Impersonation and fake documents.</strong> Pretending to be someone else, claiming service, awards, rank or a discharge you don’t have (stolen valor), or uploading altered or AI-generated documents.</li>
          <li><strong>Operational security.</strong> Classified information, Controlled Unclassified Information (CUI), unit movements, deployment dates and locations, or photos of restricted areas. If you wouldn’t say it outside the wire, don’t post it.</li>
          <li><strong>Other people’s private information.</strong> Home addresses, phone numbers, documents, or photos of someone shared without their permission.</li>
          <li><strong>Political campaigning.</strong> Talking about issues that affect veterans is welcome; campaigning for candidates or parties isn’t, and active-duty members must follow DoD rules on political activity.</li>
        </ul>
        <p>Some words and phrases are blocked automatically, and you’ll be told when a post or message can’t be sent. Everything else is reviewed by a person when it’s reported.</p>
      </section>
      <section>
        <h2>How we enforce it</h2>
        <p>Members can report any profile, post, comment, message, review, project or job. Every report is reviewed by a person, and every action is logged with the reason.</p>
        <ul>
          <li><strong>Strike 1 — Warning.</strong> The content is removed and you’re told what happened and why.</li>
          <li><strong>Strike 2 — 7-day suspension.</strong> You can’t use LanceNest during the suspension.</li>
          <li><strong>Strike 3 — Removal.</strong> Your account is permanently removed.</li>
        </ul>
        <p>Serious violations lead to immediate removal without warnings: sexual content involving anyone under 18 (reported to the National Center for Missing &amp; Exploited Children), threats of violence, sexual harassment, fraud or fake documents, impersonation, and sharing classified information. Removed members can’t create a new account.</p>
        <p>You can see your own conduct record in Account settings, and you can appeal any action within 30 days through the <a className="text-navy underline" href="/help?kind=support&subject=Appeal">Help page</a> or by emailing <a className="text-navy underline" href="mailto:support@lancenest.com">support@lancenest.com</a>.</p>
      </section>
    </LegalPage>
  );
}
