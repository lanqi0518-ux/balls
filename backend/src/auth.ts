import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from './config.js';

/**
 * Guards endpoints that change tracker state or expose wallet configuration.
 * Without this anyone could exclude the largest holders from the draw or
 * hammer /api/tracker/rescan to exhaust the RPC quota.
 *
 * Fails closed: when no token is configured the endpoints are refused rather
 * than left open, so forgetting to set ADMIN_TOKEN cannot silently expose them.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!config.adminToken) {
    res.status(503).json({
      success: false,
      error: 'Admin endpoints are disabled because ADMIN_TOKEN is not configured',
    });
    return;
  }

  const header = req.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  const expected = Buffer.from(config.adminToken);
  const actual = Buffer.from(provided);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  next();
};
