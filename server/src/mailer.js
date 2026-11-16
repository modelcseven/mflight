import nodemailer from 'nodemailer';
import { getSetting } from './settings.js';

/** Sends an email if SMTP is configured; otherwise logs it. Returns {sent, reason?}. */
export async function sendMail({ to, subject, text, html }) {
  const s = await getSetting('smtp');
  if (!s.enabled || !s.host) {
    console.log(`[mail:not-configured] to=${to} subject="${subject}"\n${text}`);
    return { sent: false, reason: 'SMTP not configured' };
  }
  try {
    const t = nodemailer.createTransport({
      host: s.host,
      port: Number(s.port) || 587,
      secure: !!s.secure,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    });
    await t.sendMail({ from: s.from, to, subject, text, html: html || text.replace(/\n/g, '<br>') });
    return { sent: true };
  } catch (e) {
    console.error('[mail] send failed', e.message);
    return { sent: false, reason: e.message };
  }
}
