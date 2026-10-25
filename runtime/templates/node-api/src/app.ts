import express, { type NextFunction, type Request, type Response } from 'express';
import type { DB } from './db.js';
import { hashPassword, issueToken, readToken, verifyPassword } from './auth.js';

type Authed = Request & { userId?: number };
type Item = { id: number; title: string; done: number; created_at: string };

export function createApp(db: DB) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
    if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    try {
      const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email.toLowerCase(), hashPassword(password));
      return res.status(201).json({ token: issueToken(Number(info.lastInsertRowid)) });
    } catch {
      return res.status(409).json({ error: 'Email already registered' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    const user = typeof email === 'string'
      ? (db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email.toLowerCase()) as { id: number; password_hash: string } | undefined)
      : undefined;
    if (!user || typeof password !== 'string' || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
    return res.json({ token: issueToken(user.id) });
  });

  const requireAuth = (req: Authed, res: Response, next: NextFunction) => {
    const userId = readToken(req.headers.authorization?.replace(/^Bearer\s+/i, ''));
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    req.userId = userId;
    return next();
  };

  app.get('/api/items', requireAuth, (req: Authed, res) => {
    res.json(db.prepare('SELECT id, title, done, created_at FROM items WHERE user_id = ? ORDER BY id DESC').all(req.userId) as Item[]);
  });

  app.post('/api/items', requireAuth, (req: Authed, res) => {
    const { title } = req.body as { title?: unknown };
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Title required' });
    const info = db.prepare('INSERT INTO items (user_id, title) VALUES (?, ?)').run(req.userId, title.trim().slice(0, 200));
    return res.status(201).json(db.prepare('SELECT id, title, done, created_at FROM items WHERE id = ?').get(info.lastInsertRowid) as Item);
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  });
  return app;
}
