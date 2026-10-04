import { ImageResponse } from 'next/og';

export const alt = 'LanceNest — verified military talent for federal-ready professional work';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default link preview for every page (LinkedIn, texts, Slack, search). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0b1a24', color: '#fffdf8' }}>
        <div style={{ fontSize: 28, letterSpacing: 8, color: '#b9975b' }}>VETERAN JOBS · BUILT FOR WHAT’S NEXT</div>
        <div style={{ fontSize: 120, letterSpacing: 12, marginTop: 24 }}>LANCENEST</div>
        <div style={{ width: 140, height: 3, background: '#b9975b', marginTop: 24 }} />
        <div style={{ fontSize: 40, marginTop: 32, color: '#f4f0e7' }}>Verified military talent for federal-ready professional work.</div>
      </div>
    ),
    size,
  );
}
