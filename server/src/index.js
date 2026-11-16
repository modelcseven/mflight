import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { config } from './config.js';
import { migrate, seedIfEmpty, pool } from './db.js';
import { loadUser } from './auth.js';
import { uploadRoot } from './uploads.js';
import { verifyStripeWebhook, markOrderPaid } from './payments.js';
import { router as authRouter } from './routes/auth.js';
import { router as meRouter } from './routes/me.js';
import { router as appRouter } from './routes/app.js';
import { router as adminRouter } from './routes/admin.js';
import { scheduleJobs } from './jobs.js';
import { mountLegal } from './legal.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'connect-src': ["'self'"],
        'form-action': ["'self'", 'https://checkout.stripe.com'],
        'upgrade-insecure-requests': config.secureCookies ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());

// Stripe webhook needs the raw body for signature verification.
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const raw = req.body.toString('utf8');
  if (!(await verifyStripeWebhook(raw, req.get('stripe-signature')))) return res.status(400).send('bad signature');
  try {
    const evt = JSON.parse(raw);
    if (evt.type === 'checkout.session.completed' && evt.data?.object?.payment_status === 'paid') {
      const orderId = evt.data.object.metadata?.order_id || evt.data.object.client_reference_id;
      if (orderId) await markOrderPaid(orderId);
    }
    res.json({ received: true });
  } catch (e) {
    console.error('[stripe webhook]', e.message);
    res.status(500).send('error');
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(loadUser);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/admin', adminRouter);
app.use('/api', appRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

mountLegal(app);

app.use('/uploads', express.static(uploadRoot, { maxAge: '30d', fallthrough: false }));

const staticDir = resolve(config.staticDir);
if (existsSync(staticDir)) {
  app.use(express.static(staticDir, { index: false, maxAge: '1h', setHeaders: (res, p) => {
    if (p.includes(`${join('assets', '')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } }));
  app.get('*', (_req, res) => res.sendFile(join(staticDir, 'index.html')));
} else {
  console.warn(`[server] static dir ${staticDir} not found — API only`);
}

// Error handler: JSON for API errors.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  if (status >= 500) console.error('[error]', req.method, req.path, err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
});

async function start() {
  for (let i = 1; ; i++) {
    try {
      await migrate();
      break;
    } catch (e) {
      if (i >= 10) throw e;
      console.log(`[db] not ready (${e.message}), retrying in 3s…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  await seedIfEmpty();
  scheduleJobs();
  app.listen(config.port, () => console.log(`[server] MFlight listening on :${config.port}`));
}

start().catch((e) => {
  console.error('[server] failed to start', e);
  process.exit(1);
});
