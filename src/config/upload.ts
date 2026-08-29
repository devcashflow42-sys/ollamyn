import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { env } from './env';

// Asegura que exista el directorio de almacenamiento local.
fs.mkdirSync(env.fileStorageDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.fileStorageDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    const id = crypto.randomUUID();
    cb(null, `${id}${ext}`);
  },
});

/** Middleware de subida de un único archivo en el campo `file`. */
export const uploadSingle = multer({
  storage,
  limits: { fileSize: env.FILE_MAX_SIZE_BYTES, files: 1 },
}).single('file');
