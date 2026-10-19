import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import packages from './packages.json';

export const metadata: Metadata = { alternates: { canonical: '/licenses' }, title: 'Open-source licenses and credits' };

type Pkg = { name: string; version: string; license: string; repo: string };

/** Credits for the fonts, images, and open-source software LanceNest ships. The package list is generated from the production build's dependencies. */
export default function LicensesPage() {
  const list = packages as Pkg[];
  const byLicense = list.reduce<Record<string, Pkg[]>>((acc, p) => { (acc[p.license] ??= []).push(p); return acc; }, {});
  const order = Object.keys(byLicense).sort((a, b) => byLicense[b].length - byLicense[a].length);
  return (
    <LegalPage title="Open-source licenses and credits" updated="October 2026">
      <section>
        <p>LanceNest is built with open-source software and openly licensed fonts. We thank their authors. This page lists them with their licenses.</p>
      </section>
      <section>
        <h2>Fonts</h2>
        <ul>
          <li><strong>Inter</strong> by Rasmus Andersson — SIL Open Font License 1.1 (<a className="text-navy underline" href="/licenses/Inter-OFL.txt">license text</a>).</li>
          <li><strong>Cormorant Garamond</strong> by Christian Thalmann (Catharsis Fonts) — SIL Open Font License 1.1 (<a className="text-navy underline" href="/licenses/Cormorant-Garamond-OFL.txt">license text</a>).</li>
        </ul>
      </section>
      <section>
        <h2>Images</h2>
        <ul>
          <li>The homepage photograph of our founder was taken by a U.S. Marine Corps photographer in the course of official duties. As a work of the U.S. government, it is in the public domain; its use does not imply endorsement by the Department of Defense or the Marine Corps.</li>
          <li>Other illustrations and the LanceNest crest were created for LanceNest.</li>
        </ul>
      </section>
      <section>
        <h2>Software ({list.length} packages)</h2>
        <p>Next.js also bundles additional open-source code, with its notices included in the Next.js package.</p>
        {order.map((lic) => (
          <div key={lic} className="mt-4">
            <h3 className="font-semibold text-ink">{lic} <span className="font-normal text-muted">· {byLicense[lic].length}</span></h3>
            <p className="mt-1 text-sm leading-relaxed">
              {byLicense[lic].map((p, i) => (
                <span key={`${p.name}@${p.version}`}>
                  {i > 0 && ', '}
                  {p.repo ? <a className="text-navy underline" href={p.repo} rel="noopener noreferrer">{p.name}</a> : p.name} {p.version}
                </span>
              ))}
            </p>
            {lic === 'CC-BY-4.0' && <p className="mt-1 text-xs text-muted">Browser-support data from caniuse.com by Alexis Deveria, licensed under Creative Commons Attribution 4.0.</p>}
          </div>
        ))}
      </section>
    </LegalPage>
  );
}
