import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypts third-party secrets (an employer's hiring-system API key) before they're stored. AES-256-GCM with a
 * 32-byte key from the ATS_KEY_SECRET environment variable (base64). Without that variable the feature is off.
 */
function key(): Buffer | null {
  const raw = process.env.ATS_KEY_SECRET;
  if (!raw) return null;
  const k = Buffer.from(raw, 'base64');
  return k.length === 32 ? k : null;
}

export const SECRET_BOX_READY = () => key() !== null;

export function seal(plain: string): string {
  const k = key();
  if (!k) throw new Error('ATS_KEY_SECRET is not set');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

export function open(sealed: string): string | null {
  const k = key();
  const [v, iv, tag, body] = sealed.split('.');
  if (!k || v !== 'v1' || !iv || !tag || !body) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(body, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}
