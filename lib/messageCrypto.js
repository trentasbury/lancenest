import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). Generate one with: openssl rand -hex 32');
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptMessage(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptMessage(encoded) {
  const key = getKey();
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
