import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer, { type Options } from 'multer';
import path from 'node:path';
import { AppError } from './validate.js';

export const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};

export function uploadsDir(dataDir: string): string {
  const dir = path.join(dataDir, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Pure magic-byte check so a mislabeled payload can never masquerade as an image. */
export function sniffOk(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  switch (mime) {
    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/png':
      return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return buf.subarray(0, 6).toString('latin1') === 'GIF87a' || buf.subarray(0, 6).toString('latin1') === 'GIF89a';
    case 'image/webp':
      return buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'image/heic': {
      const brand = buf.subarray(8, 12).toString('latin1');
      return ['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(brand);
    }
    default:
      return false;
  }
}

export interface UploadEnv {
  dataDir: string;
  maxUploadMb: number;
}

export function makeUploadMiddleware(env: UploadEnv): RequestHandler {
  const dir = uploadsDir(env.dataDir);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = ALLOWED_MIME_EXT[file.mimetype];
      if (!ext) {
        cb(new AppError(415, `Unsupported image type ${file.mimetype}`), '');
        return;
      }
      cb(null, `${randomUUID()}${ext}`);
    },
  });
  const limits: Options['limits'] = {
    fileSize: Math.max(1, env.maxUploadMb) * 1024 * 1024,
    files: 6,
  };
  const upload = multer({ storage, limits });

  return (req: Request, _res: Response, next: NextFunction) => {
    upload.array('files')(req, _res, (err) => {
      if (err) return next(toAppError(err));
      // Post-flight magic-byte validation; reject & clean mismatches.
      const bag = req as Request & { files?: unknown };
      const files = (Array.isArray(bag.files) ? bag.files : []) as UploadedFile[];
      for (const f of files) {
        let ok = false;
        try {
          ok = sniffOk(fs.readFileSync(f.path), f.mimetype);
        } catch {
          ok = false;
        }
        if (!ok) {
          for (const g of files) unlinkQuietly(g.path);
          bag.files = [];
          return next(
            new AppError(415, `File "${f.originalname}" does not look like a valid ${f.mimetype}`),
          );
        }
      }
      next();
    });
  };
}

interface UploadedFile {
  path: string;
  originalname: string;
  mimetype: string;
}

function toAppError(err: unknown): Error {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'Image exceeds the size limit');
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE')
      return new AppError(400, 'Too many files or unexpected field');
    return new AppError(400, `Upload failed: ${err.message}`);
  }
  return err instanceof Error ? err : new AppError(500, 'Upload failed');
}

function unlinkQuietly(p: string | undefined): void {
  if (!p) return;
  try {
    fs.unlinkSync(p);
  } catch {
    /* best effort */
  }
}

export { unlinkQuietly };
