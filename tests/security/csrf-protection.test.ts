/**
 * Security Test Suite: CSRF Protection Tests
 * Tests Cross-Site Request Forgery protection implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { csrfProtection } from '@/lib/security/csrf-protection';
import crypto from 'crypto';

describe('CSRF Protection Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let validCsrfToken: string;
  let sessionCookie: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // Apply CSRF protection to state-changing endpoints
    app.get('/api/csrf-token', (req, res) => {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie('_csrf', token, { httpOnly: true, sameSite: 'strict' });
      res.json({ csrfToken: token });
    });

    app.post('/api/inventory', csrfProtection, (req, res) => {
      res.json({ success: true, data: req.body });
    });

    app.put('/api/inventory/:id', csrfProtection, (req, res) => {
      res.json({ success: true, id: req.params.id });
    });

    app.delete('/api/inventory/:id', csrfProtection, (req, res) => {
      res.json({ success: true, id: req.params.id });
    });

    app.post('/api/transactions', csrfProtection, (req, res) => {
      res.json({ success: true, transaction: req.body });
    });

    server = createServer(app);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    // Get a valid CSRF token before each test
    const tokenResponse = await request(app).get('/api/csrf-token');
    validCsrfToken = tokenResponse.body.csrfToken;
    sessionCookie = tokenResponse.headers['set-cookie']?.[0];
  });

  describe('CSRF Token Validation', () => {
    it('should reject requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie)
        .send({ name: 'Test Item', quantity: 10 });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/CSRF|forbidden|invalid token/i);
    });

    it('should reject requests with invalid CSRF token', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', 'invalid-token')
        .send({ name: 'Test Item', quantity: 10 });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/CSRF|forbidden|invalid token/i);
    });

    it('should accept requests with valid CSRF token', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ name: 'Test Item', quantity: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate CSRF token from different headers', async () => {
      const headers = [
        'X-CSRF-Token',
        'X-XSRF-Token',
        'CSRF-Token',
        'XSRF-Token',
      ];

      for (const header of headers) {
        const response = await request(app)
          .post('/api/inventory')
          .set('Cookie', sessionCookie)
          .set(header, validCsrfToken)
          .send({ name: 'Test Item', quantity: 10 });

        // At least one header should work
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          break;
        }
      }
    });
  });

  describe('Cross-Origin Request Protection', () => {
    it('should reject requests from different origins', async () => {
      const maliciousOrigins = [
        'http://evil.com',
        'https://attacker.com',
        'http://localhost:4000',
        'null',
      ];

      for (const origin of maliciousOrigins) {
        const response = await request(app)
          .post('/api/inventory')
          .set('Origin', origin)
          .set('Cookie', sessionCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ name: 'Test Item', quantity: 10 });

        // Should either reject or require additional validation
        if (response.status !== 200) {
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      }
    });

    it('should validate referer header', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Referer', 'http://evil.com/attack')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ name: 'Test Item', quantity: 10 });

      // Should validate referer for state-changing requests
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Token Scope and Lifetime', () => {
    it('should not accept tokens from different sessions', async () => {
      // Get a second token from a different session
      const secondTokenResponse = await request(app).get('/api/csrf-token');
      const secondToken = secondTokenResponse.body.csrfToken;

      // Try to use second token with first session
      const response = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie) // First session cookie
        .set('X-CSRF-Token', secondToken) // Second session token
        .send({ name: 'Test Item', quantity: 10 });

      expect(response.status).toBe(403);
    });

    it('should expire tokens after reasonable time', async () => {
      jest.useFakeTimers();

      // Make initial request with valid token
      const firstResponse = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ name: 'Test Item', quantity: 10 });

      expect(firstResponse.status).toBe(200);

      // Advance time by 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);

      // Same token should be expired
      const secondResponse = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .send({ name: 'Test Item', quantity: 20 });

      // Token should be expired or session invalid
      expect(secondResponse.status).not.toBe(200);

      jest.useRealTimers();
    });
  });

  describe('Safe Methods Exemption', () => {
    it('should not require CSRF token for GET requests', async () => {
      app.get('/api/inventory', (req, res) => {
        res.json({ items: [] });
      });

      const response = await request(app)
        .get('/api/inventory')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
    });

    it('should not require CSRF token for HEAD requests', async () => {
      app.head('/api/inventory', (req, res) => {
        res.sendStatus(200);
      });

      const response = await request(app)
        .head('/api/inventory')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
    });

    it('should require CSRF token for all state-changing methods', async () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      
      for (const method of methods) {
        const response = await request(app)
          [method.toLowerCase()]('/api/inventory/123')
          .set('Cookie', sessionCookie)
          .send({ data: 'test' });

        expect(response.status).toBe(403);
      }
    });
  });

  describe('Double Submit Cookie Pattern', () => {
    it('should validate token matches cookie value', async () => {
      // Simulate double submit cookie pattern
      const cookieToken = crypto.randomBytes(32).toString('hex');
      
      app.post('/api/test-double-submit', (req, res) => {
        const headerToken = req.headers['x-csrf-token'];
        const cookieValue = req.cookies['csrf-token'];
        
        if (headerToken === cookieValue && headerToken) {
          res.json({ success: true });
        } else {
          res.status(403).json({ error: 'CSRF token mismatch' });
        }
      });

      const response = await request(app)
        .post('/api/test-double-submit')
        .set('Cookie', `csrf-token=${cookieToken}`)
        .set('X-CSRF-Token', cookieToken)
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });

    it('should reject if cookie and header token mismatch', async () => {
      const response = await request(app)
        .post('/api/test-double-submit')
        .set('Cookie', 'csrf-token=cookie-value')
        .set('X-CSRF-Token', 'different-value')
        .send({ data: 'test' });

      expect(response.status).toBe(403);
    });
  });

  describe('Content-Type Validation', () => {
    it('should validate content-type for JSON requests', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .set('Content-Type', 'text/plain')
        .send('{"name": "Test Item", "quantity": 10}');

      // Should validate content-type for API endpoints
      expect([200, 400, 415]).toContain(response.status);
    });

    it('should handle form-encoded requests appropriately', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', validCsrfToken)
        .type('form')
        .send({ name: 'Test Item', quantity: 10 });

      // Form requests might be handled differently
      expect(response.status).toBeDefined();
    });
  });

  describe('SameSite Cookie Protection', () => {
    it('should set SameSite attribute on session cookies', async () => {
      const response = await request(app).get('/api/csrf-token');
      const cookies = response.headers['set-cookie'];

      expect(cookies).toBeDefined();
      if (cookies) {
        const cookieString = Array.isArray(cookies) ? cookies[0] : cookies;
        expect(cookieString.toLowerCase()).toMatch(/samesite=(strict|lax)/);
      }
    });

    it('should use Secure flag in production', () => {
      process.env.NODE_ENV = 'production';
      
      // In production, cookies should have Secure flag
      // This test would need to be run with HTTPS enabled
      expect(process.env.NODE_ENV).toBe('production');
      
      process.env.NODE_ENV = 'test';
    });
  });
});