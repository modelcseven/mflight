import crypto from 'node:crypto';
import { one, q, newId } from './db.js';
import { getSetting } from './settings.js';
import { config } from './config.js';
import { notify } from './notify.js';

export async function createOrder(userId, { type, refId, description, amount }) {
  const club = await getSetting('club');
  const id = newId('ord');
  await q(
    `INSERT INTO orders(id,user_id,type,ref_id,description,amount,currency,status,provider)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'manual')`,
    [id, userId, type, refId, description, amount, club.currency || 'EUR', amount > 0 ? 'pending' : 'paid'],
  );
  return one('SELECT * FROM orders WHERE id=$1', [id]);
}

async function stripeApi(path, params, method = 'POST') {
  const s = await getSetting('stripe');
  if (!s.enabled || !s.secretKey) throw Object.assign(new Error('Online payments are not configured.'), { status: 400 });
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${s.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error?.message || 'Stripe error'), { status: 502 });
  return json;
}

export async function stripeEnabled() {
  const s = await getSetting('stripe');
  return !!(s.enabled && s.secretKey);
}

/** Creates a Stripe Checkout session for an order; returns the hosted payment URL. */
export async function checkoutUrl(order, user, returnPath = '/profile') {
  const club = await getSetting('club');
  const session = await stripeApi('checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': (order.currency || club.currency || 'EUR').toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(Math.round(order.amount * 100)),
    'line_items[0][price_data][product_data][name]': order.description.slice(0, 200),
    customer_email: user.email,
    client_reference_id: order.id,
    'metadata[order_id]': order.id,
    success_url: `${config.appUrl}/api/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(returnPath)}`,
    cancel_url: `${config.appUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}payment=cancelled`,
  });
  await q("UPDATE orders SET provider='stripe', provider_ref=$2 WHERE id=$1", [order.id, session.id]);
  return session.url;
}

export async function confirmStripeSession(sessionId) {
  const session = await stripeApi(`checkout/sessions/${encodeURIComponent(sessionId)}`, null, 'GET');
  if (session.payment_status === 'paid') {
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (orderId) await markOrderPaid(orderId);
    return true;
  }
  return false;
}

export async function verifyStripeWebhook(rawBody, header) {
  const s = await getSetting('stripe');
  if (!s.webhookSecret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', s.webhookSecret).update(`${parts.t}.${rawBody}`).digest('hex');
  const ok = parts.v1 && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1.padEnd(expected.length).slice(0, expected.length)));
  return ok && Math.abs(Date.now() / 1000 - Number(parts.t)) < 600;
}

/** Marks an order paid and applies its effect (RSVP paid, membership extended, listing sold). Idempotent. */
export async function markOrderPaid(orderId) {
  const o = await one("UPDATE orders SET status='paid', paid_at=now() WHERE id=$1 AND status<>'paid' RETURNING *", [orderId]);
  if (!o) return;
  if (o.type === 'event') {
    await q("UPDATE rsvps SET payment_status='paid', updated_at=now() WHERE event_id=$1 AND user_id=$2", [o.ref_id, o.user_id]);
  } else if (o.type === 'membership') {
    await q(
      `UPDATE users SET tier_id=COALESCE($2,tier_id),
         membership_expires = GREATEST(COALESCE(membership_expires,current_date), current_date) + interval '1 year',
         status = CASE WHEN status='Pending' THEN status ELSE 'Active' END
       WHERE id=$1`,
      [o.user_id, o.ref_id],
    );
  } else if (o.type === 'listing') {
    await q("UPDATE listings SET status='Sold', buyer_id=$2 WHERE id=$1", [o.ref_id, o.user_id]);
    const l = await one('SELECT * FROM listings WHERE id=$1', [o.ref_id]);
    if (l) await notify(l.seller_id, 'Your listing sold', `${l.title} was purchased through the marketplace.`, '/parts');
  }
  if (o.user_id) await notify(o.user_id, 'Payment received', `${o.description} — thank you!`, '/settings?tab=billing');
}

export async function refundOrder(orderId) {
  const o = await one('SELECT * FROM orders WHERE id=$1', [orderId]);
  if (!o) return null;
  if (o.provider === 'stripe' && o.provider_ref && o.status === 'paid') {
    const session = await stripeApi(`checkout/sessions/${encodeURIComponent(o.provider_ref)}`, null, 'GET');
    if (session.payment_intent) await stripeApi('refunds', { payment_intent: session.payment_intent });
  }
  await q("UPDATE orders SET status='refunded' WHERE id=$1", [orderId]);
  if (o.type === 'event') {
    await q("UPDATE rsvps SET payment_status='refunded', updated_at=now() WHERE event_id=$1 AND user_id=$2", [o.ref_id, o.user_id]);
  }
  if (o.user_id) await notify(o.user_id, 'Refund issued', `${o.description} has been refunded.`, '/settings?tab=billing');
  return true;
}
