import { getSetting } from './settings.js';

const UPDATED = 'November 16, 2026';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, club, body) {
  const name = esc(club.name || 'MFlight');
  const color = esc(club.primaryColor || '#0066B1');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — ${name}</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;background:#f5f7fa;line-height:1.6}
header{background:${color};color:#fff;padding:20px 24px}
header a{color:#fff;text-decoration:none;font-weight:700;font-size:18px}
main{max-width:760px;margin:32px auto;background:#fff;border-radius:12px;padding:32px 36px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h1{margin-top:0;font-size:28px}h2{font-size:18px;margin-top:28px}
.muted{color:#6b7280;font-size:14px}a{color:${color}}
footer{text-align:center;color:#6b7280;font-size:13px;padding:0 0 32px}
</style></head><body>
<header><a href="/">${name}</a></header>
<main><h1>${esc(title)}</h1><p class="muted">Last updated ${UPDATED}</p>${body}</main>
<footer><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/login">Sign in</a></footer>
</body></html>`;
}

function privacy(club) {
  const name = esc(club.name || 'MFlight');
  const org = esc(club.clubName || 'the club');
  const email = esc(club.contactEmail || '');
  return `
<p>${name} is the members' platform of ${org}. This policy explains what information we collect when you use ${name}, how we use it, and the choices you have.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Account details</strong> — your name, email address and password (stored only as a secure hash), membership number and tier.</li>
<li><strong>Sign in with Google or Facebook</strong> — if you choose it, we receive your name, email address and an account identifier from that provider. We do not receive your password or access to anything else in that account.</li>
<li><strong>Content you add</strong> — profile details, cars and photos in your garage, posts, comments, likes, event registrations, guests and marketplace listings.</li>
<li><strong>Payments</strong> — event tickets and orders are paid through Stripe. Card details go directly to Stripe; we only keep the order, amount and payment status.</li>
<li><strong>Technical data</strong> — a session cookie that keeps you signed in, plus basic server logs (such as IP address and time of request) used for security.</li>
</ul>
<h2>How we use it</h2>
<ul>
<li>To run your membership: sign-in, your profile, the member feed, garages, events, the parts marketplace and payments.</li>
<li>To send account and club emails, such as email confirmation, password resets, event reminders, renewal reminders and announcements. You can change notification preferences in your account settings.</li>
<li>To keep the community safe, including moderation of reported content and an audit log of administrative actions.</li>
</ul>
<p>We do not sell your personal information and we do not use it for advertising.</p>
<h2>Who can see your information</h2>
<p>Other signed-in members can see your public profile, garage and posts according to your privacy settings. Club administrators can see member records to manage the club. We share data with service providers only as needed to run the platform (hosting, email delivery and Stripe for payments), or when required by law.</p>
<h2>Keeping and deleting data</h2>
<p>We keep your information while your membership is active. You can edit your details at any time in your account settings. To have your account and personal data deleted, contact us${email ? ` at <a href="mailto:${email}">${email}</a>` : ''}; some records, such as payment history, may be kept where the law requires it.</p>
<h2>Your rights</h2>
<p>Depending on where you live (including under the EU GDPR), you may have the right to access, correct, export or delete your personal data, and to object to or restrict its processing. Contact us to make a request.</p>
<h2>Security</h2>
<p>Connections are encrypted with HTTPS, passwords are hashed, and two-step verification is available for your account.</p>
<h2>Changes</h2>
<p>We may update this policy. The date at the top shows when it last changed.</p>
<h2>Contact</h2>
<p>${org}${email ? ` — <a href="mailto:${email}">${email}</a>` : ''}</p>`;
}

function terms(club) {
  const name = esc(club.name || 'MFlight');
  const org = esc(club.clubName || 'the club');
  const email = esc(club.contactEmail || '');
  return `
<p>These terms apply to your use of ${name}, the members' platform of ${org}. By creating an account or signing in, you agree to them.</p>
<h2>Your account</h2>
<p>You must give accurate information and keep your sign-in details secure. You are responsible for activity on your account. Membership may require approval by the club, and the club may set membership tiers, fees and renewal rules.</p>
<h2>Community rules</h2>
<ul>
<li>Be respectful. No harassment, hate speech, threats or illegal content.</li>
<li>Only post photos and content you have the right to share.</li>
<li>No spam or unauthorised advertising.</li>
</ul>
<p>Moderators may remove content or suspend accounts that break these rules.</p>
<h2>Your content</h2>
<p>You keep ownership of what you post. You allow the club to display it on ${name} so other members can see it, and to remove it if needed.</p>
<h2>Events</h2>
<p>Event details, capacity and fees are set by the organisers. Registrations may be limited or wait-listed. Taking part in driving events is at your own risk and subject to the organiser's own rules and any waivers.</p>
<h2>Parts marketplace</h2>
<p>Listings are posted by members. Unless a listing is sold by the club itself, the sale is between the buyer and seller, and the club is not responsible for the item's condition, delivery or payment between members.</p>
<h2>Payments and refunds</h2>
<p>Payments are processed by Stripe. Refunds are at the club's discretion and according to the rules shown for the event or order.</p>
<h2>Ending your membership</h2>
<p>You may stop using ${name} at any time. The club may suspend or close accounts that break these terms or whose membership has lapsed.</p>
<h2>Disclaimer</h2>
<p>${name} is provided "as is". To the extent the law allows, the club is not liable for indirect losses or for interruptions to the service.</p>
<h2>Changes</h2>
<p>We may update these terms. Continuing to use ${name} after a change means you accept the updated terms.</p>
<h2>Contact</h2>
<p>${org}${email ? ` — <a href="mailto:${email}">${email}</a>` : ''}</p>`;
}

export function mountLegal(app) {
  app.get('/privacy', async (_req, res, next) => {
    try { const club = await getSetting('club'); res.type('html').send(page('Privacy Policy', club, privacy(club))); } catch (e) { next(e); }
  });
  app.get('/terms', async (_req, res, next) => {
    try { const club = await getSetting('club'); res.type('html').send(page('Terms of Service', club, terms(club))); } catch (e) { next(e); }
  });
}
