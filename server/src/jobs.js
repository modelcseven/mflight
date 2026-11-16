import { many, q } from './db.js';
import { getSetting } from './settings.js';
import { notify } from './notify.js';
import { sendMail } from './mailer.js';
import { audit } from './audit.js';

/** Daily housekeeping: renewal reminders, expired-membership suspension, event reminders. */
export async function runDailyJobs() {
  const m = await getSetting('membership');
  const club = await getSetting('club');

  // 1. Renewal reminders (once per expiry date).
  const days = Number(m.renewalReminderDays) || 0;
  if (days > 0) {
    const due = await many(
      `SELECT id, email, first_name, membership_expires, prefs FROM users
       WHERE status='Active' AND membership_expires IS NOT NULL
         AND membership_expires BETWEEN current_date AND current_date + $1::int
         AND (renewal_reminded_for IS DISTINCT FROM membership_expires)`,
      [days],
    );
    for (const u of due) {
      await notify(u.id, 'Membership renewal due', `Your membership expires on ${u.membership_expires}. Renew to keep your benefits.`, '/settings?tab=billing');
      if (u.prefs?.emailNotifications !== false) {
        await sendMail({ to: u.email, subject: `Your ${club.name} membership expires soon`,
          text: `Hi ${u.first_name},\n\nYour membership expires on ${u.membership_expires}. Renew any time from Settings → Membership & billing.` });
      }
      await q('UPDATE users SET renewal_reminded_for=membership_expires WHERE id=$1', [u.id]);
    }
    if (due.length) console.log(`[jobs] sent ${due.length} renewal reminders`);
  }

  // 2. Suspend members past expiry + grace period.
  if (m.autoSuspendExpired) {
    const grace = Number(m.gracePeriodDays) || 0;
    const expired = await many(
      `UPDATE users SET status='Suspended', token_version=token_version+1
       WHERE role='member' AND status='Active' AND membership_expires IS NOT NULL
         AND membership_expires + $1::int < current_date
       RETURNING id`,
      [grace],
    );
    for (const u of expired) await audit(null, 'user.auto_suspended', 'user', u.id, { reason: 'membership expired' });
    if (expired.length) console.log(`[jobs] suspended ${expired.length} expired memberships`);
  }

  // 3. Event reminders 3 days before start.
  const soon = await many(
    `SELECT r.id, r.user_id, u.email, u.first_name, u.prefs, e.title, e.start_date, e.location
     FROM rsvps r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.user_id
     WHERE r.status='going' AND NOT r.reminded AND NOT e.cancelled
       AND e.start_date BETWEEN current_date AND current_date + 3`,
  );
  for (const r of soon) {
    if (r.prefs?.eventReminders !== false) {
      await notify(r.user_id, `Coming up: ${r.title}`, `${r.location} · starts ${r.start_date}`, '/events');
      if (r.prefs?.emailNotifications !== false) {
        await sendMail({ to: r.email, subject: `Reminder: ${r.title} starts ${r.start_date}`,
          text: `Hi ${r.first_name},\n\n${r.title} in ${r.location} starts on ${r.start_date}. See the Events page for details.` });
      }
    }
    await q('UPDATE rsvps SET reminded=true WHERE id=$1', [r.id]);
  }
}

export function scheduleJobs() {
  const run = () => runDailyJobs().catch((e) => console.error('[jobs] failed', e.message));
  setTimeout(run, 30_000);
  setInterval(run, 6 * 60 * 60 * 1000);
}
