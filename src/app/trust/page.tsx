import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { alternates: { canonical: '/trust' }, title: 'Trust & verification', description: 'What LanceNest verifies, what it doesn’t, and how member documents and data are protected.' };

export default function TrustPage() {
  const S = ({ h, children }: { h: string; children: React.ReactNode }) => <section><h2 className="font-serif text-2xl text-navy">{h}</h2><div className="mt-2 space-y-2">{children}</div></section>;
  return (
    <article className="container-page max-w-3xl space-y-8 py-14 text-[16px] leading-relaxed text-ink/90">
      <h1 className="font-serif text-4xl font-medium">Trust & verification</h1>
      <S h="What “verified member” means"><p>A LanceNest reviewer has confirmed proof of military service — a DD-214, VA benefit summary letter, recent LES, orders, or NGB-22. It confirms service — it is not a criminal background check, employment verification, credential check, or clearance verification. Documents are deleted when the review is complete, or automatically after 30 days if never reviewed. Military ID cards and clearance records are never accepted.</p></S>
      <S h="What “verified employer” means"><p>The company’s identity was confirmed — by a work-email domain that matches its website, or by a manual review of business documents — before it could post jobs, search, or message members. It does not guarantee an employer’s hiring practices, financial condition, or a job offer. Verified employers can still be reported, and reports are reviewed.</p></S>
      <S h="Documents we never accept"><ul className="list-disc space-y-1 pl-6"><li>Military ID cards (CAC) or any government ID card</li><li>Security clearance records or DISS printouts</li><li>Classified information, CUI, or FCI</li><li>Government system passwords or credentials</li><li>Anything you aren’t allowed to share</li></ul><p>Before uploading proof of service, cover your Social Security number, VA file number, and home address. Documents are never accepted by email.</p></S>
      <S h="What LanceNest does not verify"><ul className="list-disc space-y-1 pl-6"><li>Security clearances — they are self-reported and labeled that way. Employers confirm eligibility through official government channels.</li><li>Licenses, certifications, background checks, or work authorization.</li><li>The quality of any job, project, or hire.</li></ul></S>
      <S h="Your privacy"><p>You control whether verified employers can see your profile. Never share classified information, Controlled Unclassified Information (CUI), or Federal Contract Information (FCI) on LanceNest.</p></S>
      <S h="Payments"><p>Freelance milestone payments are held and released through Stripe Connect when the client approves the work — or automatically 14 days after it’s submitted, with a reminder 3 days before. Either side can open a dispute; LanceNest reviews it. “Verified Work” means a contract was completed and paid through LanceNest.</p></S>
      <S h="Conduct and safety"><p>Members and employers follow the <Link href="/conduct" className="text-navy underline">Code of Conduct</Link>. Anything can be reported, and repeat or serious violations lead to removal.</p></S>
      <S h="Safety"><ul className="list-disc space-y-1 pl-6"><li>Employers can never charge you to apply, interview, or be hired — report anyone who asks for money, gift cards, or bank details.</li><li>Every profile, post, and message has Report and Block options; reported content is reviewed, and repeat or serious violations lead to removal.</li><li>Be wary of anyone who wants to move to another app right away, asks for your Social Security number, or sends a check to deposit.</li><li>If anyone threatens harm, call 911 first, then report it to us.</li></ul></S>
      <S h="More"><p><Link href="/security" className="text-navy underline">Security</Link> · <Link href="/accessibility" className="text-navy underline">Accessibility</Link> · <Link href="/privacy" className="text-navy underline">Privacy</Link> · <Link href="/terms" className="text-navy underline">Terms</Link> · questions: <a href="mailto:support@lancenest.com" className="text-navy underline">support@lancenest.com</a></p></S>
    </article>
  );
}
