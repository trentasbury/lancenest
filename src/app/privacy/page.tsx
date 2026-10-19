import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { alternates: { canonical: '/privacy' }, title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <section>
        <p>LanceNest (“we,” “us”) is a professional network and job platform for active duty, transitioning, and veteran service members and the employers who hire them. This policy explains what we collect, why, and the choices you have.</p>
      </section>
      <section className="rounded-2xl border border-brass/50 bg-paper p-5">
        <h2>The short version</h2>
        <ul>
          <li><strong>Service documents</strong> (DD-214, LES, orders, NGB-22, VA letters) and a <strong>photo ID</strong> (driver’s license, state ID, or passport) are used only to verify your service and that the documents are yours. A person compares them by eye — no face-matching software — and both are deleted as soon as the reviewer approves or rejects them, or automatically after 30 days if never reviewed. Never upload military, VA, or other federal ID cards, or clearance records.</li>
          <li><strong>Your profile</strong> is visible to verified members and verified employers. You can hide it from employers entirely or from specific companies in Account settings.</li>
          <li><strong>Clearances</strong> you list are self-reported and labeled that way.</li>
          <li><strong>Payments</strong> are processed by Stripe; we never store card numbers.</li>
          <li><strong>Analytics</strong> are first-party and cookie-free; we don’t sell your data or show ads.</li>
          <li><strong>Service providers:</strong> Vercel (hosting), Supabase (database and storage), Stripe (payments), Resend (email), Cloudflare Turnstile (bot protection), and Google (optional sign-in).</li>
          <li><strong>AI:</strong> LanceNest does not send your profile or documents to AI services, and does not use your data to train AI models.</li>
          <li><strong>Your choices:</strong> edit or delete your profile anytime, and delete your account in Account settings. Questions or requests: support@lancenest.com or our Help page (lancenest.com/help).</li>
        </ul>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account information:</strong> your name, email address, password (stored only as a secure hash by our authentication provider), and whether you joined as a service member or an employer. If you choose “Continue with Google,” Google shares your name, email address, and profile picture with us; we never receive your Google password.</li>
          <li><strong>Profile information you choose to add:</strong> headline, about, location, military service (branch, rank, occupation code, years, deployments), civilian experience, education, skills, and security clearance level. We never ask for clearance investigation details.</li>
          <li><strong>Verification documents:</strong> when you verify your service, the two files you upload: a service document (for example a DD-214 with your Social Security number blacked out) and a photo ID (a driver’s license, state ID, or passport with the ID number covered). See “Verification documents” below.</li>
          <li><strong>Activity:</strong> jobs you save or apply to, posts, comments, reactions, follows, messages, and reports you submit.</li>
          <li><strong>Company information</strong> for employer accounts, and job postings they publish.</li>
          <li><strong>Technical data:</strong> security cookies that keep you signed in and sign you out after inactivity, and basic request logs used to operate and secure the service. We count page visits with our own private analytics: no cookies, no cross-site tracking, and visitors are identified only by an anonymous code that changes every day. We do not use advertising or tracking cookies.</li>
        </ul>
      </section>
      <section>
        <h2>Verification documents</h2>
        <p>We ask for a photo ID along with your service document so a reviewer can confirm both belong to you. Both files are stored in private storage that only you and our reviewers can open. Reviewers open them through links that expire after 10 minutes, and every time they do is recorded in an access log. A person compares them by eye; we don’t use facial-recognition or face-matching software, and we never create or keep biometric data. Both files are <strong>deleted as soon as the reviewer approves or rejects them</strong>, or automatically after 30 days if never reviewed. Files uploaded but never submitted for review are deleted within 48 hours. The files are never attached to emails.</p>
        <p>We keep the result (verified or not) and a one-way code made from the name and date of birth on your documents. It is used only to stop duplicate and banned accounts, and it can’t be turned back into your details. Never upload a military, VA, or other federal ID card — copying one is prohibited by federal law (18 U.S.C. § 701).</p>
      </section>
      <section>
        <h2>How we use your information</h2>
        <ul>
          <li>To run your account, show your profile, and connect you with employers and other members.</li>
          <li>To translate military experience into civilian terms and suggest jobs and people you may want to connect with.</li>
          <li>To verify service, prevent fraud and abuse, enforce our Terms, and keep the platform secure.</li>
          <li>To send account emails (confirmations, password resets, and notifications you can see in your account).</li>
        </ul>
        <p><strong>We do not sell your personal information,</strong> and we do not share it with advertisers.</p>
      </section>
      <section>
        <h2>Who can see what</h2>
        <ul>
          <li><strong>Employers on LanceNest</strong> can see service member profiles so they can recruit. Your email address is never shown on your profile.</li>
          <li><strong>Other members</strong> see your name, headline, and branch on your posts. Your full profile is visible to them only if you make it public.</li>
          <li><strong>Your résumé</strong> is visible only to you and to verified companies you’ve applied to, sent a proposal to, or are messaging with — plus verified employers on paid plans. Other members can never see it, and each download link expires within a minute.</li>
          <li><strong>Posts</strong> follow the audience you choose: Public, Network (all members), Connections, or Private (only you).</li>
          <li><strong>Messages</strong> are visible only to the people in the conversation, and to our team when investigating a report.</li>
        </ul>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>We use trusted providers to operate LanceNest: Supabase (database, authentication, file storage), Vercel (hosting), Cloudflare Turnstile (bot protection), Resend (email delivery), and Google (if you choose to sign in with Google). When paid plans launch, payments will be processed by Stripe; we will not store full card numbers. These providers process data only to provide their services to us.</p>
      </section>
      <section>
        <h2>Security</h2>
        <p>We encrypt connections with HTTPS, restrict every database record to the people allowed to see it, require two-step login for administrators, limit repeated actions to stop abuse, and sign accounts out after 30 minutes of inactivity. No system is perfectly secure, so please use a strong, unique password.</p>
      </section>
      <section>
        <h2>Your choices and rights</h2>
        <ul>
          <li>Edit or remove profile information at any time from your dashboard.</li>
          <li>Delete your posts, comments, and saved items; block or mute other members.</li>
          <li>Delete your account yourself in Account settings, or request a copy of your data or deletion of your account by emailing <a className="text-navy underline" href="mailto:support@lancenest.com">support@lancenest.com</a> or through our <a className="text-navy underline" href="/help">Help page</a>. Deleting your account removes your profile, posts, messages you sent, and related records.</li>
          <li>Depending on where you live, you may have additional rights under state privacy laws; contact us and we will honor them.</li>
        </ul>
      </section>
      <section>
        <h2>Retention</h2>
        <p>We keep account information while your account is active and delete it when you ask us to, except where we must keep limited records for legal, security, or fraud-prevention reasons.</p>
      </section>
      <section>
        <h2>Age requirement</h2>
        <p>LanceNest is for people 18 and older. We do not knowingly collect information from anyone under 18.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>We will post updates here and notify members of significant changes. Questions: <a className="text-navy underline" href="mailto:support@lancenest.com">support@lancenest.com</a>.</p>
      </section>
    </LegalPage>
  );
}
