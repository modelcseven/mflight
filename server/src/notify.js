import { q } from './db.js';

/** In-app notification for a single user (or everyone when userId is null). */
export async function notify(userId, title, body = '', link = null) {
  await q('INSERT INTO notifications(user_id,title,body,link) VALUES ($1,$2,$3,$4)', [userId, title, body, link]);
}
