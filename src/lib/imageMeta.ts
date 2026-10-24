/**
 * Removes hidden metadata from photos before they go on public pages: GPS location, camera make and serial
 * number, the time taken, editing history and text comments. Phone photos often carry the exact spot they were
 * taken, which for service members can be a home or a unit's location.
 *
 * Works on the file's bytes (JPEG, PNG, WebP), so the picture itself and its quality are untouched. A JPEG's
 * rotation is kept by writing back a tiny EXIF block holding only the orientation. Runs in the browser and on the
 * server. Anything it can't read safely is returned as null, and callers refuse that upload.
 */

const JPEG_KEEP_APP = new Set([0xe0, 0xe2, 0xee]); // JFIF, ICC colour profile, Adobe colour transform

export function stripImageMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return stripJpeg(bytes);
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return stripPng(bytes);
  if (bytes.length > 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return stripWebp(bytes);
  return null;
}

/** For browser uploads: a cleaned copy of the file (same name and type), or null if it can't be read safely. */
export async function cleanImageFile(file: File): Promise<File | null> {
  const out = stripImageMetadata(new Uint8Array(await file.arrayBuffer()));
  return out ? new File([new Uint8Array(out)], file.name, { type: file.type }) : null;
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ---------- JPEG ----------

/** Reads the orientation (1–8) from an APP1 EXIF segment's data, or 1 when absent or unreadable. */
function exifOrientation(seg: Uint8Array): number {
  if (seg.length < 14 || ascii(seg, 0, 6) !== 'Exif\0\0') return 1;
  const t = 6;
  const le = ascii(seg, t, 2) === 'II';
  if (!le && ascii(seg, t, 2) !== 'MM') return 1;
  const u16 = (i: number) => (i + 2 <= seg.length ? (le ? seg[i] | (seg[i + 1] << 8) : (seg[i] << 8) | seg[i + 1]) : -1);
  const u32 = (i: number) => (i + 4 <= seg.length ? (le ? (seg[i] | (seg[i + 1] << 8) | (seg[i + 2] << 16)) + seg[i + 3] * 0x1000000 : seg[i] * 0x1000000 + ((seg[i + 1] << 16) | (seg[i + 2] << 8) | seg[i + 3])) : -1);
  const ifd = u32(t + 4);
  if (ifd < 8) return 1;
  const count = u16(t + ifd);
  if (count < 0 || count > 500) return 1;
  for (let n = 0; n < count; n++) {
    const e = t + ifd + 2 + n * 12;
    if (u16(e) === 0x0112) { const v = u16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
  }
  return 1;
}

/** A minimal APP1 EXIF segment holding only the orientation. */
function orientationSegment(o: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xe1, 0x00, 0x22, // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, o, 0x00, 0x00, // Orientation, SHORT, 1, value
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
}

function stripJpeg(b: Uint8Array): Uint8Array | null {
  const kept: Uint8Array[] = [b.subarray(0, 2)];
  let orientation = 1;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let m = b[i + 1];
    while (m === 0xff && i + 2 < b.length) { i++; m = b[i + 1]; } // fill bytes
    if (m === undefined) return null;
    if (m === 0xd9) { kept.push(b.subarray(i, i + 2)); break; } // end of image
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { kept.push(b.subarray(i, i + 2)); i += 2; continue; }
    if (i + 4 > b.length) return null;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    const seg = b.subarray(i, i + 2 + len);
    if (m === 0xda) {
      // Start of scan: copy the header, then the compressed image data up to the next real marker (a 0xFF that
      // isn't byte stuffing or a restart marker). Progressive photos have several scans, so the loop goes on.
      let j = i + 2 + len;
      while (j + 1 < b.length && !(b[j] === 0xff && b[j + 1] !== 0x00 && !(b[j + 1] >= 0xd0 && b[j + 1] <= 0xd7) && b[j + 1] !== 0xff)) j++;
      if (j + 1 >= b.length) return null;
      kept.push(b.subarray(i, j));
      i = j;
      continue;
    }
    const isApp = m >= 0xe0 && m <= 0xef;
    if (m === 0xe1) { const o = exifOrientation(b.subarray(i + 4, i + 2 + len)); if (o !== 1) orientation = o; }
    // APP2 is kept only for a colour profile (its other use points at extra pictures stored after the photo).
    const keepApp = JPEG_KEEP_APP.has(m) && (m !== 0xe2 || ascii(b, i + 4, 12) === 'ICC_PROFILE\0');
    if ((isApp && !keepApp) || m === 0xfe) { i += 2 + len; continue; } // EXIF, XMP, comments and the rest
    kept.push(seg);
    i += 2 + len;
  }
  // Anything after the end-of-image marker (some phones store extra pictures there) is dropped.
  if (kept.at(-1)?.[1] !== 0xd9) return null;
  if (orientation !== 1) {
    // After SOI, and after the JFIF block when there is one.
    const at = kept.length > 1 && kept[1][1] === 0xe0 ? 2 : 1;
    kept.splice(at, 0, orientationSegment(orientation));
  }
  return concat(kept);
}

// ---------- PNG ----------

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(b: Uint8Array): Uint8Array | null {
  const kept: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i < b.length) {
    if (i + 12 > b.length) return null;
    const len = ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (!PNG_DROP.has(type)) kept.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return concat(kept);
}

// ---------- WebP ----------

function stripWebp(b: Uint8Array): Uint8Array | null {
  const kept: Uint8Array[] = [];
  let i = 12;
  while (i < b.length) {
    if (i + 8 > b.length) return null;
    const type = ascii(b, i, 4);
    const len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] * 0x1000000);
    const end = i + 8 + len + (len % 2);
    if (i + 8 + len > b.length) return null;
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = b.slice(i, Math.min(end, b.length));
      if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~0x0c; // the "has EXIF" and "has XMP" flags
      kept.push(chunk);
    }
    i = end;
  }
  const body = concat(kept);
  const size = body.length + 4;
  const head = new Uint8Array([0x52, 0x49, 0x46, 0x46, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff, 0x57, 0x45, 0x42, 0x50]);
  return concat([head, body]);
}
