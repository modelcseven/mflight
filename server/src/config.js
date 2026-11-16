import crypto from 'node:crypto';

const env = process.env;

if (!env.JWT_SECRET) {
  console.warn('[config] JWT_SECRET not set — using a random secret (sessions reset on restart). Set JWT_SECRET in production.');
}

export const config = {
  port: Number(env.PORT || 3000),
  appUrl: (env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL || 'postgres://postgres@localhost:5432/mflight',
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  uploadDir: env.UPLOAD_DIR || './uploads',
  staticDir: env.STATIC_DIR || '../app/dist',
  adminEmail: env.ADMIN_EMAIL || 'admin@mflight.local',
  adminPassword: env.ADMIN_PASSWORD || '',
  adminFirstName: env.ADMIN_FIRST_NAME || 'Club',
  adminLastName: env.ADMIN_LAST_NAME || 'Admin',
  demoPassword: env.DEMO_PASSWORD || '',
  secureCookies: env.NODE_ENV === 'production',
};
