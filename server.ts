import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { committeeStore } from './server/committeeStore.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const sseClients = new Set<Response>();
const publicEventSseClients = new Set<Response>();

// Simple brute-force guard for PIN login attempts per IP
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return null;
}

function requireCommitteeAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!committeeStore.verifySessionToken(token)) {
    res.status(401).json({
      error: 'Sesi panitia tidak valid atau sudah berakhir. Silakan masukkan PIN kembali.',
    });
    return;
  }
  next();
}

function broadcastCommitteeSnapshot(): void {
  const payload = JSON.stringify({
    type: 'snapshot',
    registrations: committeeStore.getRegistrations(),
    eventInfo: committeeStore.getEventInfo(),
    serverTime: new Date().toISOString(),
  });
  for (const client of sseClients) {
    try {
      client.write(`event: snapshot\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function broadcastEventInfoUpdate(): void {
  const payload = JSON.stringify({
    type: 'event_info',
    eventInfo: committeeStore.getEventInfo(),
  });
  for (const client of publicEventSseClients) {
    try {
      client.write(`event: event_info\ndata: ${payload}\n\n`);
    } catch {
      publicEventSseClients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // --- Public API Routes (No PII list exposure) ---

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/event-info', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ eventInfo: committeeStore.getEventInfo() });
  });

  app.get('/api/event-info/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    publicEventSseClients.add(res);
    res.write(
      `event: event_info\ndata: ${JSON.stringify({
        type: 'event_info',
        eventInfo: committeeStore.getEventInfo(),
      })}\n\n`
    );

    const pingId = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingId);
        publicEventSseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(pingId);
      publicEventSseClients.delete(res);
    });
  });

  app.post('/api/registrations', (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const created = committeeStore.createRegistration({
        id: typeof body?.id === 'string' ? body.id : undefined,
        registrationCode:
          typeof body?.registrationCode === 'string' ? body.registrationCode : undefined,
        createdAt: typeof body?.createdAt === 'string' ? body.createdAt : undefined,
        childName: typeof body?.childName === 'string' ? body.childName : '',
        parentName: typeof body?.parentName === 'string' ? body.parentName : '',
        age: typeof body?.age === 'number' ? body.age : Number(body?.age || 6),
        whatsapp: typeof body?.whatsapp === 'string' ? body.whatsapp : '',
        competitions: Array.isArray(body?.competitions) ? body.competitions : ['balap-karung'],
      });
      broadcastCommitteeSnapshot();
      res.status(201).json({ registration: created });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Gagal memproses pendaftaran.',
      });
    }
  });

  app.post('/api/lookup-tickets', (req: Request, res: Response) => {
    const body = req.body as {
      parentName?: string;
      registrationCode?: string;
      childName?: string;
    };
    const parentName = typeof body?.parentName === 'string' ? body.parentName : '';
    const registrationCode =
      typeof body?.registrationCode === 'string' ? body.registrationCode : undefined;
    const childName = typeof body?.childName === 'string' ? body.childName : undefined;

    if (!parentName.trim() || (!registrationCode?.trim() && !childName?.trim())) {
      res.status(400).json({
        error: 'Masukkan nama orang tua serta kode daftar atau nama anak.',
      });
      return;
    }

    const matches = committeeStore.lookupTickets({
      parentName,
      registrationCode,
      childName,
    });
    res.json({ registrations: matches });
  });

  // --- Committee PIN Authentication & Protected Real-Time Routes ---

  app.post('/api/committee/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (record && record.blockedUntil > now) {
      const waitSec = Math.ceil((record.blockedUntil - now) / 1000);
      res.status(429).json({
        error: `Terlalu banyak percobaan PIN salah. Silakan coba lagi dalam ${waitSec} detik.`,
      });
      return;
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    if (!committeeStore.verifyCommitteePin(pin)) {
      const prevCount = record ? record.count : 0;
      const nextCount = prevCount + 1;
      loginAttempts.set(ip, {
        count: nextCount,
        blockedUntil: nextCount >= 5 ? now + 30_000 : 0,
      });
      res.status(401).json({ error: 'PIN salah. Silakan masukkan PIN panitia yang benar.' });
      return;
    }

    loginAttempts.delete(ip);
    const session = committeeStore.issueSessionToken();
    res.json(session);
  });

  app.get('/api/committee/verify', requireCommitteeAuth, (_req: Request, res: Response) => {
    res.json({ valid: true });
  });

  app.get('/api/committee/registrations', requireCommitteeAuth, (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      registrations: committeeStore.getRegistrations(),
      eventInfo: committeeStore.getEventInfo(),
    });
  });

  app.get('/api/committee/stream', requireCommitteeAuth, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    const initialPayload = JSON.stringify({
      type: 'snapshot',
      registrations: committeeStore.getRegistrations(),
      eventInfo: committeeStore.getEventInfo(),
      serverTime: new Date().toISOString(),
    });
    res.write(`event: snapshot\ndata: ${initialPayload}\n\n`);

    const pingId = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingId);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(pingId);
      sseClients.delete(res);
    });
  });

  app.put('/api/committee/registrations/:id', requireCommitteeAuth, (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const updated = committeeStore.updateRegistration(id, req.body || {});
      broadcastCommitteeSnapshot();
      res.json({ registration: updated });
    } catch (err) {
      res.status(404).json({
        error: err instanceof Error ? err.message : 'Gagal memperbarui data peserta.',
      });
    }
  });

  app.patch(
    '/api/committee/registrations/:id/checkin',
    requireCommitteeAuth,
    (req: Request, res: Response) => {
      try {
        const id = String(req.params.id || '');
        const checkedIn = Boolean(req.body?.checkedIn);
        const updated = committeeStore.checkInRegistration(id, checkedIn);
        broadcastCommitteeSnapshot();
        res.json({ registration: updated });
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : 'Gagal memperbarui status kehadiran.',
        });
      }
    }
  );

  app.delete(
    '/api/committee/registrations/:id',
    requireCommitteeAuth,
    (req: Request, res: Response) => {
      const id = String(req.params.id || '');
      committeeStore.deleteRegistration(id);
      broadcastCommitteeSnapshot();
      res.json({ deleted: true });
    }
  );

  app.put('/api/committee/event-info', requireCommitteeAuth, (req: Request, res: Response) => {
    const updated = committeeStore.updateEventInfo(req.body || {});
    broadcastCommitteeSnapshot();
    broadcastEventInfoUpdate();
    res.json({ eventInfo: updated });
  });

  app.post('/api/committee/pin', requireCommitteeAuth, (req: Request, res: Response) => {
    try {
      const currentPin = typeof req.body?.currentPin === 'string' ? req.body.currentPin : '';
      const newPin = typeof req.body?.newPin === 'string' ? req.body.newPin : '';
      const freshToken = committeeStore.changeCommitteePin(currentPin, newPin);
      res.json({ success: true, token: freshToken });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Gagal mengubah PIN panitia.',
      });
    }
  });

  app.post('/api/committee/restore', requireCommitteeAuth, (req: Request, res: Response) => {
    const result = committeeStore.restoreBackup(req.body || {});
    broadcastCommitteeSnapshot();
    broadcastEventInfoUpdate();
    res.json(result);
  });

  // --- Frontend Serving (Dev Vite Middleware / Prod Dist) ---

  if (IS_PROD && fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'))) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response) => {
      try {
        const url = req.originalUrl;
        const indexHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const template = await vite.transformIndexHtml(url, indexHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: unknown) {
        const err = e as Error;
        vite.ssrFixStacktrace(err);
        res.status(500).end(err.message);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
