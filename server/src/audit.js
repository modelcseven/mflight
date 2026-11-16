import { q } from './db.js';

export async function audit(req, action, targetType = null, targetId = null, details = {}) {
  try {
    await q(
      'INSERT INTO audit_log(actor_id,action,target_type,target_id,details,ip) VALUES ($1,$2,$3,$4,$5,$6)',
      [req?.user?.id ?? null, action, targetType, targetId, details, req?.ip ?? null],
    );
  } catch (e) {
    console.error('[audit] failed', e.message);
  }
}
