import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="September 2026">
      <section>
        <p>These Terms govern your use of LanceNest. By creating an account or using the site, you agree to them and to our <Link href="/privacy" className="text-navy underline">Privacy Policy</Link>.</p>
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
      </section>
      <section>
        <h2>Plans and payments</h2>
        <p>Core features are free for service members. Paid plans, when offered, will show their price and terms before you buy, renew automatically until canceled, and can be canceled at any time for the end of the current billing period. Fees for any freelance marketplace will be shown before you accept work.</p>
        <p><strong>Refunds.</strong> Subscription payments are non-refundable; canceling stops future charges and your plan stays active until the end of the period you paid for. Featured-job boosts are non-refundable once the job is featured. If you believe you were charged in error, contact us within 30 days and we will make it right.</p>
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
        <p>You may close your account at any time by contacting us. We may suspend or end access for violations of these Terms or to protect members and the service.</p>
      </section>
      <section>
        <h2>Changes, law, and contact</h2>
        <p>We may update these Terms and will notify members of significant changes. These Terms are governed by the laws of the State of Florida. Questions: <a className="text-navy underline" href="mailto:support@lancenest.com">support@lancenest.com</a>.</p>
      </section>
    </LegalPage>
  );
}
