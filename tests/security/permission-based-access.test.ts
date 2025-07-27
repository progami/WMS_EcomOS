/**
 * Security Test Suite: Permission-Based Access Control Tests
 * Tests the permission system to ensure proper access control
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import express from 'express';
import { getServerSession } from 'next-auth';
import { checkPermission } from '@/lib/utils/permission-helpers';

const prisma = new PrismaClient();

describe('Permission-Based Access Control Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let users: {
    admin: { id: string; token: string };
    warehouseManager: { id: string; token: string };
    inventoryClerk: { id: string; token: string };
    viewer: { id: string; token: string };
    noPermissions: { id: string; token: string };
  };

  beforeAll(async () => {
    // Create test users with different permission levels
    const adminUser = await prisma.users.create({
      data: {
        email: 'admin@test.com',
        name: 'Admin User',
        permissions: {
          create: {
            name: 'ADMIN',
            canViewInventory: true,
            canManageInventory: true,
            canViewFinance: true,
            canManageFinance: true,
            canViewReports: true,
            canManageUsers: true,
            canManageSettings: true,
            canViewWarehouse: true,
            canManageWarehouse: true,
          },
        },
      },
      include: { permissions: true },
    });

    const warehouseManagerUser = await prisma.users.create({
      data: {
        email: 'warehouse@test.com',
        name: 'Warehouse Manager',
        permissions: {
          create: {
            name: 'WAREHOUSE_MANAGER',
            canViewInventory: true,
            canManageInventory: true,
            canViewFinance: false,
            canManageFinance: false,
            canViewReports: true,
            canManageUsers: false,
            canManageSettings: false,
            canViewWarehouse: true,
            canManageWarehouse: true,
          },
        },
      },
      include: { permissions: true },
    });

    const inventoryClerkUser = await prisma.users.create({
      data: {
        email: 'clerk@test.com',
        name: 'Inventory Clerk',
        permissions: {
          create: {
            name: 'INVENTORY_CLERK',
            canViewInventory: true,
            canManageInventory: true,
            canViewFinance: false,
            canManageFinance: false,
            canViewReports: false,
            canManageUsers: false,
            canManageSettings: false,
            canViewWarehouse: true,
            canManageWarehouse: false,
          },
        },
      },
      include: { permissions: true },
    });

    const viewerUser = await prisma.users.create({
      data: {
        email: 'viewer@test.com',
        name: 'Viewer',
        permissions: {
          create: {
            name: 'VIEWER',
            canViewInventory: true,
            canManageInventory: false,
            canViewFinance: false,
            canManageFinance: false,
            canViewReports: true,
            canManageUsers: false,
            canManageSettings: false,
            canViewWarehouse: true,
            canManageWarehouse: false,
          },
        },
      },
      include: { permissions: true },
    });

    const noPermissionsUser = await prisma.users.create({
      data: {
        email: 'noperm@test.com',
        name: 'No Permissions User',
        permissions: {
          create: {
            name: 'RESTRICTED',
            canViewInventory: false,
            canManageInventory: false,
            canViewFinance: false,
            canManageFinance: false,
            canViewReports: false,
            canManageUsers: false,
            canManageSettings: false,
            canViewWarehouse: false,
            canManageWarehouse: false,
          },
        },
      },
      include: { permissions: true },
    });

    // Generate mock tokens for each user
    users = {
      admin: { id: adminUser.id, token: `mock-token-${adminUser.id}` },
      warehouseManager: { id: warehouseManagerUser.id, token: `mock-token-${warehouseManagerUser.id}` },
      inventoryClerk: { id: inventoryClerkUser.id, token: `mock-token-${inventoryClerkUser.id}` },
      viewer: { id: viewerUser.id, token: `mock-token-${viewerUser.id}` },
      noPermissions: { id: noPermissionsUser.id, token: `mock-token-${noPermissionsUser.id}` },
    };

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use(async (req: any, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      const token = authHeader.replace('Bearer ', '');
      const userEntry = Object.values(users).find(u => u.token === token);
      
      if (!userEntry) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const user = await prisma.users.findUnique({
        where: { id: userEntry.id },
        include: { permissions: true },
      });

      req.user = user;
      next();
    });

    // Permission middleware
    const requirePermission = (permission: keyof any) => {
      return (req: any, res: express.Response, next: express.NextFunction) => {
        if (!req.user?.permissions?.[permission]) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
      };
    };

    // Test endpoints
    app.get('/api/inventory', requirePermission('canViewInventory'), (req, res) => {
      res.json({ data: 'inventory data' });
    });

    app.post('/api/inventory', requirePermission('canManageInventory'), (req, res) => {
      res.json({ success: true });
    });

    app.get('/api/finance/reports', requirePermission('canViewFinance'), (req, res) => {
      res.json({ data: 'finance reports' });
    });

    app.post('/api/finance/invoices', requirePermission('canManageFinance'), (req, res) => {
      res.json({ success: true });
    });

    app.get('/api/admin/users', requirePermission('canManageUsers'), (req, res) => {
      res.json({ users: [] });
    });

    app.put('/api/admin/settings', requirePermission('canManageSettings'), (req, res) => {
      res.json({ success: true });
    });

    app.get('/api/warehouses', requirePermission('canViewWarehouse'), (req, res) => {
      res.json({ warehouses: [] });
    });

    app.post('/api/warehouses', requirePermission('canManageWarehouse'), (req, res) => {
      res.json({ success: true });
    });

    server = createServer(app);
  });

  afterAll(async () => {
    // Cleanup users
    await prisma.users.deleteMany({
      where: {
        email: {
          in: ['admin@test.com', 'warehouse@test.com', 'clerk@test.com', 'viewer@test.com', 'noperm@test.com'],
        },
      },
    });

    await prisma.$disconnect();
    server.close();
  });

  describe('Admin Access', () => {
    it('should allow admin to access all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/inventory' },
        { method: 'post', path: '/api/inventory' },
        { method: 'get', path: '/api/finance/reports' },
        { method: 'post', path: '/api/finance/invoices' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'put', path: '/api/admin/settings' },
        { method: 'get', path: '/api/warehouses' },
        { method: 'post', path: '/api/warehouses' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${users.admin.token}`)
          .send({});

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Warehouse Manager Access', () => {
    it('should allow warehouse manager to access inventory and warehouse endpoints', async () => {
      const allowedEndpoints = [
        { method: 'get', path: '/api/inventory' },
        { method: 'post', path: '/api/inventory' },
        { method: 'get', path: '/api/warehouses' },
        { method: 'post', path: '/api/warehouses' },
      ];

      for (const endpoint of allowedEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${users.warehouseManager.token}`)
          .send({});

        expect(response.status).toBe(200);
      }
    });

    it('should deny warehouse manager access to finance and admin endpoints', async () => {
      const deniedEndpoints = [
        { method: 'get', path: '/api/finance/reports' },
        { method: 'post', path: '/api/finance/invoices' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'put', path: '/api/admin/settings' },
      ];

      for (const endpoint of deniedEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${users.warehouseManager.token}`)
          .send({});

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/insufficient permissions/i);
      }
    });
  });

  describe('Inventory Clerk Access', () => {
    it('should allow inventory clerk to view and manage inventory', async () => {
      const response1 = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${users.inventoryClerk.token}`);

      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${users.inventoryClerk.token}`)
        .send({});

      expect(response2.status).toBe(200);
    });

    it('should allow inventory clerk to view but not manage warehouses', async () => {
      const viewResponse = await request(app)
        .get('/api/warehouses')
        .set('Authorization', `Bearer ${users.inventoryClerk.token}`);

      expect(viewResponse.status).toBe(200);

      const manageResponse = await request(app)
        .post('/api/warehouses')
        .set('Authorization', `Bearer ${users.inventoryClerk.token}`)
        .send({});

      expect(manageResponse.status).toBe(403);
    });

    it('should deny inventory clerk access to finance and admin', async () => {
      const deniedEndpoints = [
        { method: 'get', path: '/api/finance/reports' },
        { method: 'post', path: '/api/finance/invoices' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'put', path: '/api/admin/settings' },
      ];

      for (const endpoint of deniedEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${users.inventoryClerk.token}`)
          .send({});

        expect(response.status).toBe(403);
      }
    });
  });

  describe('Viewer Access', () => {
    it('should allow viewer read-only access to permitted areas', async () => {
      const allowedEndpoints = [
        { method: 'get', path: '/api/inventory' },
        { method: 'get', path: '/api/warehouses' },
      ];

      for (const endpoint of allowedEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${users.viewer.token}`);

        expect(response.status).toBe(200);
      }
    });

    it('should deny viewer all write operations', async () => {
      const deniedEndpoints = [
        { method: 'post', path: '/api/inventory' },
        { method: 'post', path: '/api/warehouses' },
        { method: 'post', path: '/api/finance/invoices' },
        { method: 'put', path: '/api/admin/settings' },
      ];

      for (const endpoint of deniedEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${users.viewer.token}`)
          .send({});

        expect(response.status).toBe(403);
      }
    });
  });

  describe('No Permissions User', () => {
    it('should deny access to all protected endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/inventory' },
        { method: 'post', path: '/api/inventory' },
        { method: 'get', path: '/api/finance/reports' },
        { method: 'post', path: '/api/finance/invoices' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'put', path: '/api/admin/settings' },
        { method: 'get', path: '/api/warehouses' },
        { method: 'post', path: '/api/warehouses' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${users.noPermissions.token}`)
          .send({});

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/insufficient permissions/i);
      }
    });
  });

  describe('Permission Escalation Prevention', () => {
    it('should prevent users from modifying their own permissions', async () => {
      app.put('/api/users/:id/permissions', async (req: any, res) => {
        const { id } = req.params;
        const requestingUserId = req.user.id;

        // Users cannot modify their own permissions
        if (id === requestingUserId) {
          return res.status(403).json({ error: 'Cannot modify own permissions' });
        }

        // Only admins can modify permissions
        if (!req.user.permissions?.canManageUsers) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        res.json({ success: true });
      });

      // Clerk tries to modify their own permissions
      const response = await request(app)
        .put(`/api/users/${users.inventoryClerk.id}/permissions`)
        .set('Authorization', `Bearer ${users.inventoryClerk.token}`)
        .send({ canManageFinance: true });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/cannot modify own permissions/i);
    });

    it('should prevent non-admins from modifying any permissions', async () => {
      // Warehouse manager tries to modify clerk's permissions
      const response = await request(app)
        .put(`/api/users/${users.inventoryClerk.id}/permissions`)
        .set('Authorization', `Bearer ${users.warehouseManager.token}`)
        .send({ canManageFinance: true });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/insufficient permissions/i);
    });

    it('should allow admins to modify other users permissions', async () => {
      const response = await request(app)
        .put(`/api/users/${users.inventoryClerk.id}/permissions`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .send({ canViewReports: true });

      expect(response.status).toBe(200);
    });
  });

  describe('Unauthorized Access', () => {
    it('should deny access without authentication token', async () => {
      const response = await request(app)
        .get('/api/inventory');

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/no authorization header/i);
    });

    it('should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid token/i);
    });

    it('should deny access with malformed authorization header', async () => {
      const malformedHeaders = [
        'InvalidFormat token',
        'Bearer',
        'Token abc123',
        'Basic dXNlcjpwYXNz',
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/inventory')
          .set('Authorization', header);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Permission Caching and Performance', () => {
    it('should efficiently check permissions without database lookups', async () => {
      // Simulate permission caching
      const permissionCache = new Map();
      
      app.get('/api/cached-endpoint', async (req: any, res) => {
        const userId = req.user.id;
        let permissions = permissionCache.get(userId);
        
        if (!permissions) {
          const user = await prisma.users.findUnique({
            where: { id: userId },
            include: { permissions: true },
          });
          permissions = user?.permissions;
          permissionCache.set(userId, permissions);
        }

        if (!permissions?.canViewInventory) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        res.json({ data: 'cached response' });
      });

      // First request - cache miss
      const start1 = Date.now();
      const response1 = await request(app)
        .get('/api/cached-endpoint')
        .set('Authorization', `Bearer ${users.inventoryClerk.token}`);
      const duration1 = Date.now() - start1;

      expect(response1.status).toBe(200);

      // Second request - cache hit (should be faster)
      const start2 = Date.now();
      const response2 = await request(app)
        .get('/api/cached-endpoint')
        .set('Authorization', `Bearer ${users.inventoryClerk.token}`);
      const duration2 = Date.now() - start2;

      expect(response2.status).toBe(200);
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('Permission Helper Functions', () => {
    it('should correctly evaluate complex permission rules', () => {
      const testCases = [
        {
          user: { permissions: { canViewInventory: true, canManageInventory: false } },
          action: 'view',
          resource: 'inventory',
          expected: true,
        },
        {
          user: { permissions: { canViewInventory: true, canManageInventory: false } },
          action: 'edit',
          resource: 'inventory',
          expected: false,
        },
        {
          user: { permissions: { canViewFinance: false, canManageFinance: false } },
          action: 'view',
          resource: 'finance',
          expected: false,
        },
      ];

      testCases.forEach(testCase => {
        const hasPermission = checkPermission(
          testCase.user as any,
          testCase.action,
          testCase.resource
        );
        expect(hasPermission).toBe(testCase.expected);
      });
    });
  });
});