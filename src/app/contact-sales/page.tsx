import type { Metadata } from 'next';
import SubmitButton from '@/components/SubmitButton';
import { requestCall } from './actions';

export const metadata: Metadata = { title: 'Book a call', description: 'Talk with LanceNest about Federal and Enterprise hiring plans for verified service members and cleared talent.' };

export default function ContactSalesPage({ searchParams }: { searchParams: { plan?: string; sent?: string; error?: string } }) {
  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page max-w-3xl py-14">
        <p className="eyebrow text-brass">Federal & Enterprise</p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Book a call.</h1>
        <p className="mt-3 text-cream/80">Tell us what you’re hiring for. We’ll reply within one business day to set up a 20-minute call — volume pricing, cleared talent, career fairs, and team seats.</p>
      </div></section>
      <div className="container-page max-w-3xl py-12">
        {searchParams.sent ? (
          <div className="card p-8 text-center"><p className="font-serif text-2xl text-navy">Thank you — we’ll be in touch within one business day.</p><p className="mt-2 text-muted">Questions in the meantime: support@lancenest.com</p></div>
        ) : (
          <form action={requestCall} className="card grid gap-4 p-7 sm:grid-cols-2">
            {searchParams.error && <p className="text-sm text-signal sm:col-span-2">Please add your name, company, and a valid work email.</p>}
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <div><label className="field-label" htmlFor="name">Your name</label><input id="name" name="name" required className="field" /></div>
            <div><label className="field-label" htmlFor="email">Work email</label><input id="email" name="email" type="email" required className="field" /></div>
            <div><label className="field-label" htmlFor="company">Company or agency</label><input id="company" name="company" required className="field" /></div>
            <div><label className="field-label" htmlFor="size">Company size</label><select id="size" name="size" className="field"><option>1–50</option><option>51–250</option><option>251–1,000</option><option>1,000+</option></select></div>
            <div><label className="field-label" htmlFor="plan">Interested in</label><select id="plan" name="plan" defaultValue={searchParams.plan === 'enterprise' ? 'Enterprise' : 'Federal'} className="field"><option>Federal</option><option>Enterprise</option><option>Not sure yet</option></select></div>
            <div><label className="field-label" htmlFor="times">Good times to talk</label><input id="times" name="times" placeholder="e.g. Weekdays after 2pm ET" className="field" /></div>
            <div className="sm:col-span-2"><label className="field-label" htmlFor="needs">What are you hiring for?</label><textarea id="needs" name="needs" rows={4} placeholder="Roles, locations, clearance levels, number of hires" className="field" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Sending…">Request a call</SubmitButton></div>
          </form>
        )}
      </div>
    </>
  );
}
