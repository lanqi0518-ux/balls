import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requireAdmin } from './auth.js';
import { config } from './config.js';

function invoke(authorization?: string) {
  const req = {
    get: (name: string) =>
      name.toLowerCase() === 'authorization' ? authorization : undefined,
  } as any;

  const res = {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };

  const next = vi.fn();
  requireAdmin(req, res as any, next);

  return { res, next };
}

describe('requireAdmin', () => {
  const originalToken = config.adminToken;

  beforeEach(() => {
    config.adminToken = 'super-secret-token';
  });

  afterEach(() => {
    config.adminToken = originalToken;
  });

  it('lets a request through with the right token', () => {
    const { res, next } = invoke('Bearer super-secret-token');
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('rejects a request with no authorization header', () => {
    // Regression: /api/tracker/exclude and /api/tracker/rescan used to be
    // open to anyone, so a stranger could drop the largest holders from the
    // draw or hammer a full chain rescan.
    const { res, next } = invoke(undefined);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a wrong token', () => {
    const { res, next } = invoke('Bearer nope');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token that is only a prefix of the real one', () => {
    const { res, next } = invoke('Bearer super-secret');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a raw token without the Bearer scheme', () => {
    const { res, next } = invoke('super-secret-token');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('fails closed when no token is configured', () => {
    config.adminToken = '';
    const { res, next } = invoke('Bearer anything');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });
});
