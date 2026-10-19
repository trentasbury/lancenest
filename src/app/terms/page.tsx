import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';

export const metadata: Metadata = { alternates: { canonical: '/terms' }, title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 2026">
      <section>
        <p>These Terms govern your use of LanceNest. By creating an account or using the site, you agree to them and to our <Link href="/privacy" className="text-navy underline">Privacy Policy</Link>.</p>
      </section>
      <section>
        <h2>Information you may not share</h2>
        <p>Never post, message, upload, or attach classified information, Controlled Unclassified Information (CUI), Federal Contract Information (FCI), export-controlled data, procurement-sensitive material, government system credentials, or clearance records. LanceNest is not designed or authorized to handle them, and we remove such content when we find it.</p>
        <p>For employers: LanceNest is a sourcing and hiring tool. It does not replace your own legal obligations — for example, federal contractors’ VEVRAA job-listing and affirmative-action duties, pay-transparency rules, equal employment opportunity laws, USERRA, or worker-classification rules. You are responsible for the lawfulness of your job posts, screening questions, and hiring decisions.</p>
      </section>
      <section>
        <h2>Security clearances</h2>
        <p>LanceNest verifies military service; it does not verify security clearances or clearance eligibility. Clearance information on profiles is self-reported. Members must list only a clearance they currently hold or held within the last two years, must never share classified information, and agree that misrepresenting a clearance is grounds for removal. Employers are responsible for confirming eligibility through official government systems before relying on it.</p>
      </section>
      <section>
        <h2>Freelance work and Protected Payments</h2>
        {!FREELANCE_PAYMENTS_ENABLED && (
          <p><strong>Milestone payments through LanceNest are not available yet.</strong> Until they are, clients and freelancers agree on and make payments directly with each other. LanceNest is not a party to those payments and does not hold, process, or guarantee them. The payment terms below apply once milestone payments are available on LanceNest.</p>
        )}
        <p>Freelancers are independent contractors, not employees of LanceNest or of their clients through LanceNest. Clients fund each milestone before work begins. LanceNest holds the funds through its payment processor (Stripe) and releases them to the freelancer when the client approves the work, or automatically 14 days after the work is submitted if the client doesn’t approve, request changes, or open a dispute. LanceNest is not an escrow agent or a party to the work agreement.</p>
        <p>Either party may open a dispute on a funded milestone; LanceNest reviews the contract, messages, and delivered work and decides whether to release the funds to the freelancer or refund the client, and that decision is final on LanceNest. Refunds return the milestone amount; the client service fee (the percentage fee and the contract-start fee) covers payment processing and is non-refundable. Milestones are at least $25. Fees are shown before every payment. Stripe verifies freelancers’ identity and may issue tax forms (such as Form 1099-K) as required by law.</p>
        <p>Members who list services are responsible for holding any license, certification, permit, or insurance the work legally requires where it is performed, and for doing the work safely. Members currently serving are responsible for obtaining any required approval for off-duty employment and may not use government time, property, rank, or uniform to promote or perform their services. LanceNest does not supervise or guarantee services, and clients should confirm licensing for regulated trades.</p>
        <p>{FREELANCE_PAYMENTS_ENABLED ? 'Keep work and payments on LanceNest. ' : 'Once milestone payments are available, keep work and payments on LanceNest. '}Taking a client relationship you met here off the platform to avoid fees (circumvention) is prohibited and may result in removal. Hiring a freelancer you met here as a full-time employee is permitted.</p>
      </section>
      <section>
        <h2>Independence</h2>
        <p>LanceNest is not affiliated with, endorsed by, or sponsored by the U.S. Department of Defense, the Department of Veterans Affairs, the U.S. Armed Forces, or any branch of service. Service branch names and occupation codes are used only to describe members’ experience. Civilian career paths shown for military occupations are LanceNest’s guidance, not official equivalencies.</p>
      </section>
      <section>
        <h2>Eligibility and accounts</h2>
        <ul>
          <li>You must be at least 18 years old.</li>
          <li>Service member accounts are for active duty, Guard, Reserve, transitioning, and veteran members. Employer accounts are for organizations and recruiters hiring for real positions.</li>
          <li>Provide accurate information, keep your password secure, and tell us promptly if you believe your account was compromised. You are responsible for activity on your account.</li>
        </ul>
      </section>
      <section>
        <h2>Verification</h2>
        <p>A Verified Veteran badge means our team reviewed a document you provided. It is not a background check or a guarantee of anyone’s identity, character, or qualifications. Submitting false or altered documents will result in removal.</p>
      </section>
      <section>
        <h2>What you may not do</h2>
        <ul>
          <li><strong>Share classified information or Controlled Unclassified Information (CUI)</strong> anywhere on LanceNest, including messages.</li>
          <li>Upload a military ID card or any document you are not permitted to share.</li>
          <li>Impersonate anyone, claim service you did not perform, or misrepresent a clearance.</li>
          <li>Post fake jobs, scams, spam, or requests for payment from candidates.</li>
          <li>Harass, threaten, or discriminate against anyone, or post unlawful or sexually explicit content.</li>
          <li>Scrape the site, use bots, try to access data you are not authorized to see, or interfere with the service or its security.</li>
        </ul>
      </section>
      <section>
        <h2>Employers</h2>
        <p>Employers must post only real, lawful positions; comply with applicable employment laws, including equal employment opportunity and veterans’ reemployment protections; and use candidate information only for recruiting. Employers may not charge candidates to apply or be hired.</p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>You own what you post. You give LanceNest a non-exclusive, worldwide, royalty-free license to host, display, and distribute it as needed to operate the service, according to the audience you choose. You can delete your content at any time. We may remove content or suspend accounts that violate these Terms.</p>
        <p><strong>Copyright.</strong> Post only content you own or have permission to use. We respond to copyright notices as described in our <Link href="/copyright" className="text-navy underline">Copyright policy</Link>, and we end the accounts of repeat infringers.</p>
      </section>
      <section>
        <h2>Plans and payments</h2>
        <p>Core features are free for service members. Paid plans show their price, billing period, and terms before you buy. <strong>Subscriptions renew automatically</strong> at the then-current price for the same period (monthly or yearly) until you cancel. You can cancel at any time in Billing (from your dashboard), without contacting us; canceling stops future charges, and your plan stays active until the end of the period you paid for. Founding and other introductory prices apply only for the period stated at checkout; after that, the plan renews at its regular price. Fees for any freelance marketplace will be shown before you accept work.</p>
        <p><strong>Refunds.</strong> Except where the law requires a refund, subscription payments are non-refundable, featured-job boosts are non-refundable once the job is featured, and proposal packs are non-refundable once added to your account. If you believe you were charged in error, twice, or without your permission, contact us within 30 days and we will make it right.</p>
      </section>
      <section>
        <h2>No guarantees</h2>
        <p>LanceNest connects people; it is not an employer, staffing agency, or party to any job or engagement. We do not guarantee interviews, offers, or the accuracy of what members or employers post. The service is provided “as is” and “as available.”</p>
      </section>
      <section>
        <h2>Limitation of liability</h2>
        <p>To the fullest extent permitted by law, LanceNest is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or data. Our total liability for any claim is limited to the greater of the amount you paid us in the 12 months before the claim or $100.</p>
      </section>
      <section>
        <h2>Ending your use</h2>
        <p>You may delete your account at any time in Account settings, or ask us to by email. We may suspend or end access for violations of these Terms or to protect members and the service.</p>
      </section>
      <section>
        <h2>Changes, law, and contact</h2>
        <p>We may update these Terms and will notify members of significant changes. These Terms are governed by the laws of the State of Florida. Questions: <a className="text-navy underline" href="mailto:support@lancenest.com">support@lancenest.com</a>.</p>
      </section>
    </LegalPage>
  );
}
