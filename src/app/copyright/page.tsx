import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { alternates: { canonical: '/copyright' }, title: 'Copyright policy' };

// Fill these in once LanceNest's designated agent is registered with the U.S. Copyright Office (copyright.gov/dmca-directory).
const AGENT: { name: string; address: string; email: string; phone: string } | null = null;

export default function CopyrightPage() {
  const notices = '/help?kind=support&subject=Copyright%20notice';
  return (
    <LegalPage title="Copyright policy" updated="October 2026">
      <section>
        <p>LanceNest respects the rights of creators, and we expect members and employers to post only content they own or have permission to use. We respond to notices of claimed copyright infringement under the Digital Millennium Copyright Act (17 U.S.C. § 512).</p>
      </section>
      <section>
        <h2>Where to send a notice</h2>
        {AGENT ? (
          <p>Designated agent: {AGENT.name}, {AGENT.address}. Email: <a className="text-navy underline" href={`mailto:${AGENT.email}`}>{AGENT.email}</a>. Phone: {AGENT.phone}.</p>
        ) : (
          <p>Our designated agent’s registration with the U.S. Copyright Office is being completed, and the agent’s details will be listed here. Until then, send notices through our <Link className="text-navy underline" href={notices}>Help page</Link> with the subject “Copyright notice.” A person reviews every notice.</p>
        )}
      </section>
      <section>
        <h2>What a notice must include</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Your physical or electronic signature, as the copyright owner or someone authorized to act for them.</li>
          <li>The copyrighted work you believe was infringed (or a representative list, if several).</li>
          <li>The material you believe infringes, and where it is on LanceNest — the page link is best.</li>
          <li>Your name, mailing address, phone number, and email address.</li>
          <li>A statement that you believe in good faith the use is not authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement that the information in your notice is accurate and, under penalty of perjury, that you are the owner or authorized to act for the owner.</li>
        </ol>
      </section>
      <section>
        <h2>What happens next</h2>
        <p>When we receive a complete notice, we remove or disable access to the material and tell the member who posted it, including a copy of the notice. Incomplete notices may not be acted on.</p>
      </section>
      <section>
        <h2>Counter-notices</h2>
        <p>If your material was removed and you believe that was a mistake or misidentification, you can send a counter-notice the same way. It must include:</p>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Your physical or electronic signature.</li>
          <li>The material that was removed and where it appeared before removal.</li>
          <li>A statement, under penalty of perjury, that you believe in good faith it was removed by mistake or misidentification.</li>
          <li>Your name, address, and phone number, and a statement that you consent to the jurisdiction of the federal district court for your address (or, if you are outside the United States, any judicial district where LanceNest may be found), and that you will accept service of process from the person who sent the original notice.</li>
        </ol>
        <p>We send the counter-notice to the person who filed the original notice. Unless they tell us they have filed a court action, we restore the material 10 to 14 business days after we receive the counter-notice.</p>
      </section>
      <section>
        <h2>Repeat infringers</h2>
        <p>We end the accounts of members who repeatedly infringe copyrights. An account that receives three valid notices within 12 months is removed, and we may act sooner for clear or willful infringement.</p>
      </section>
      <section>
        <h2>Please be accurate</h2>
        <p>Under 17 U.S.C. § 512(f), anyone who knowingly misrepresents that material is infringing, or that it was removed by mistake, may be liable for damages. If you are unsure whether something infringes, consider speaking with a lawyer first.</p>
        <p>For trademark or other concerns that aren’t copyright, use our <Link className="text-navy underline" href="/help">Help page</Link> or the Report option on the content.</p>
      </section>
    </LegalPage>
  );
}
