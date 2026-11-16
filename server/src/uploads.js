import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

export const uploadRoot = resolve(config.uploadDir);
mkdirSync(uploadRoot, { recursive: true });

const ALLOWED = { '.jpg': 1, '.jpeg': 1, '.png': 1, '.webp': 1, '.gif': 1};

export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadRoot,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED[extname(file.originalname).toLowerCase()] && file.mimetype.startsWith('image/');
    cb(ok ? null : Object.assign(new Error('Only image files (jpg, png, webp, gif) are allowed.'), { status: 400 }), !!ok);
  },
});
