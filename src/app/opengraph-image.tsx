import { ImageResponse } from 'next/og';

export const alt = 'LanceNest — verified military talent for federal-ready professional work';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The LanceNest mark, ivory and brass for the dark background.
const MARK = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510 320"><defs><linearGradient id="fs" gradientUnits="userSpaceOnUse" x1="215" y1="236" x2="491" y2="49"><stop offset="0" stop-color="#fffdf8"/><stop offset="0.28" stop-color="#d9c9a8"/><stop offset="0.6" stop-color="#b9975b"/><stop offset="1" stop-color="#d4b77c"/></linearGradient><linearGradient id="fw" gradientUnits="userSpaceOnUse" x1="8" y1="309" x2="340" y2="124"><stop offset="0" stop-color="#7a6136"/><stop offset="1" stop-color="#c4a467"/></linearGradient></defs><path fill="#fffdf8" d="M246 14Q250 11 257 11L336 11L252 153L139 203Z"/><path fill="url(#fw)" d="M8 309C60 268 170 200 340 124C250 175 150 250 89 285C60 297 30 302 8 309Z"/><path fill="url(#fs)" d="M184 240L188 232Q285 158 403 97L332 94Q420 74 491 49Q448 108 422 170L423 113Q340 178 284 240Z"/><path fill="#fffdf8" d="M188 232L434 231C412 251 394 268 381 278C373 284 363 287 352 287L118 287Z"/></svg>').toString('base64')}`;

/** Default link preview for every page (LinkedIn, texts, Slack, search). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0b1a24', color: '#fffdf8' }}>
        <img src={MARK} width={204} height={128} alt="" style={{ marginBottom: 28 }} />
        <div style={{ fontSize: 28, letterSpacing: 8, color: '#b9975b' }}>VETERAN JOBS · BUILT FOR WHAT’S NEXT</div>
        <div style={{ fontSize: 120, letterSpacing: 12, marginTop: 24 }}>LANCENEST</div>
        <div style={{ width: 140, height: 3, background: '#b9975b', marginTop: 24 }} />
        <div style={{ fontSize: 40, marginTop: 32, color: '#f4f0e7' }}>Verified military talent for federal-ready professional work.</div>
      </div>
    ),
    size,
  );
}
