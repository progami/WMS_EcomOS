/**
 * Security Test Suite: Rate Limiting Tests
 * Tests the effectiveness of rate limiting implementation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit';

describe('Rate Limiting Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;

  beforeAll(() => {
    app = express();
    
    // Apply rate limiting middleware
    app.use('/api/', rateLimit(rateLimitConfig));
    
    // Test endpoints
    app.get('/api/test', (req, res) => {
      res.json({ success: true });
    });

    app.post('/api/login', (req, res) => {
      res.json({ success: true });
    });

    app.get('/api/inventory', (req, res) => {
      res.json({ items: [] });
    });

    server = createServer(app);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('General API Rate Limiting', () => {
    it('should limit requests per IP address', async () => {
      const maxRequests = 100; // Default limit
      const responses = [];

      // Make requests up to the limit
      for (let i = 0; i < maxRequests + 5; i++) {
        const response = await request(app)
          .get('/api/test')
          .set('X-Forwarded-For', '192.168.1.1');
        
        responses.push(response.status);
      }

      // First 100 should succeed
      const successfulRequests = responses.slice(0, maxRequests).filter(status => status === 200);
      expect(successfulRequests).toHaveLength(maxRequests);

      // Requests beyond limit should be rate limited
      const rateLimitedRequests = responses.slice(maxRequests).filter(status => status === 429);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    it('should return proper rate limit headers', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.1.2');

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should reset rate limit after window expires', async () => {
      jest.useFakeTimers();

      // Make a request
      const firstResponse = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.1.3');
      
      expect(firstResponse.status).toBe(200);

      // Advance time past rate limit window (15 minutes)
      jest.advanceTimersByTime(16 * 60 * 1000);

      // Request should succeed again
      const secondResponse = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.1.3');
      
      expect(secondResponse.status).toBe(200);

      jest.useRealTimers();
    });
  });

  describe('Authentication Endpoint Rate Limiting', () => {
    it('should have stricter limits for login endpoints', async () => {
      const loginLimit = 5; // Stricter limit for auth endpoints
      const responses = [];

      for (let i = 0; i < loginLimit + 2; i++) {
        const response = await request(app)
          .post('/api/login')
          .set('X-Forwarded-For', '192.168.1.4')
          .send({ email: 'test@example.com', password: 'password' });
        
        responses.push(response.status);
      }

      // Should allow first 5 attempts
      const successfulAttempts = responses.slice(0, loginLimit).filter(status => status === 200);
      expect(successfulAttempts).toHaveLength(loginLimit);

      // Should block subsequent attempts
      const blockedAttempts = responses.slice(loginLimit).filter(status => status === 429);
      expect(blockedAttempts.length).toBeGreaterThan(0);
    });

    it('should track rate limits per IP, not per user', async () => {
      const ip1Responses = [];
      const ip2Responses = [];

      // Make requests from different IPs
      for (let i = 0; i < 3; i++) {
        const response1 = await request(app)
          .post('/api/login')
          .set('X-Forwarded-For', '192.168.1.5')
          .send({ email: 'user1@example.com', password: 'password' });
        
        const response2 = await request(app)
          .post('/api/login')
          .set('X-Forwarded-For', '192.168.1.6')
          .send({ email: 'user1@example.com', password: 'password' });
        
        ip1Responses.push(response1.status);
        ip2Responses.push(response2.status);
      }

      // Both IPs should have successful requests
      expect(ip1Responses.filter(status => status === 200).length).toBeGreaterThan(0);
      expect(ip2Responses.filter(status => status === 200).length).toBeGreaterThan(0);
    });
  });

  describe('Distributed Attack Prevention', () => {
    it('should handle requests from multiple IPs', async () => {
      const ipAddresses = Array.from({ length: 50 }, (_, i) => `192.168.2.${i + 1}`);
      const responses = [];

      // Simulate distributed attack
      for (const ip of ipAddresses) {
        const response = await request(app)
          .get('/api/inventory')
          .set('X-Forwarded-For', ip);
        
        responses.push(response.status);
      }

      // All requests should succeed as they're from different IPs
      const successfulRequests = responses.filter(status => status === 200);
      expect(successfulRequests).toHaveLength(ipAddresses.length);
    });

    it('should detect and block rapid requests from same IP', async () => {
      const responses = [];
      const startTime = Date.now();

      // Make 20 rapid requests
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .get('/api/test')
          .set('X-Forwarded-For', '192.168.3.1');
        
        responses.push({
          status: response.status,
          timestamp: Date.now() - startTime,
        });
      }

      // Should detect rapid requests and apply rate limiting
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Bypass Prevention', () => {
    it('should not be bypassed by changing user agent', async () => {
      const userAgents = [
        'Mozilla/5.0',
        'Chrome/91.0',
        'Safari/14.0',
        'Bot/1.0',
      ];

      let totalRequests = 0;
      let blockedRequests = 0;

      for (const ua of userAgents) {
        for (let i = 0; i < 30; i++) {
          const response = await request(app)
            .get('/api/test')
            .set('X-Forwarded-For', '192.168.4.1')
            .set('User-Agent', ua);
          
          totalRequests++;
          if (response.status === 429) {
            blockedRequests++;
          }
        }
      }

      // Should block requests regardless of user agent
      expect(blockedRequests).toBeGreaterThan(0);
    });

    it('should not be bypassed by adding headers', async () => {
      const headers = [
        { 'X-Real-IP': '10.0.0.1' },
        { 'X-Original-IP': '10.0.0.2' },
        { 'CF-Connecting-IP': '10.0.0.3' },
        { 'True-Client-IP': '10.0.0.4' },
      ];

      let blockedCount = 0;

      for (const header of headers) {
        for (let i = 0; i < 30; i++) {
          const response = await request(app)
            .get('/api/test')
            .set('X-Forwarded-For', '192.168.5.1')
            .set(header);
          
          if (response.status === 429) {
            blockedCount++;
          }
        }
      }

      // Should track by primary IP regardless of additional headers
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Error Messages', () => {
    it('should return informative error message when rate limited', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 101; i++) {
        await request(app)
          .get('/api/test')
          .set('X-Forwarded-For', '192.168.6.1');
      }

      // Next request should be rate limited
      const response = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.6.1');

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/rate limit|too many requests/i);
    });

    it('should include retry-after header', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 101; i++) {
        await request(app)
          .get('/api/test')
          .set('X-Forwarded-For', '192.168.7.1');
      }

      const response = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.7.1');

      expect(response.status).toBe(429);
      expect(response.headers).toHaveProperty('retry-after');
    });
  });
});