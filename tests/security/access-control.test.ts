/**
 * Security Test Suite: Access Control Tests
 * Tests permission-based access control and authorization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authConfig } from '@/lib/auth';
import { getServerSession } from 'next-auth';

const prisma = new PrismaClient();

interface User {
  id: string;
  email: string;
  name: string;
  permissions: string[];
}

interface Session {
  user: User;
}

describe('Access Control Tests', () => {
  let app: express.Application;
  let server: ReturnType<typeof createServer>;
  let adminUser: User;
  let regularUser: User;
  let readOnlyUser: User;

  beforeAll(async () => {
    // Create test users with different permissions
    adminUser = {
      id: '1',
      email: 'admin@test.com',
      name: 'Admin User',
      permissions: ['inventory:read', 'inventory:write', 'inventory:delete', 'admin:all'],
    };

    regularUser = {
      id: '2',
      email: 'user@test.com',
      name: 'Regular User',
      permissions: ['inventory:read', 'inventory:write'],
    };

    readOnlyUser = {
      id: '3',
      email: 'readonly@test.com',
      name: 'Read Only User',
      permissions: ['inventory:read'],
    };

    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const userId = authHeader.split(' ')[1];
        switch (userId) {
          case 'admin':
            req.user = adminUser;
            break;
          case 'user':
            req.user = regularUser;
            break;
          case 'readonly':
            req.user = readOnlyUser;
            break;
          default:
            req.user = null;
        }
      }
      next();
    });

    // Permission checking middleware
    const requirePermission = (permission: string) => {
      return (req: any, res: express.Response, next: express.NextFunction) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin:all')) {
          return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        
        next();
      };
    };

    // Define routes with permission requirements
    app.get('/api/inventory', requirePermission('inventory:read'), (req, res) => {
      res.json({ items: [], user: req.user?.email });
    });

    app.post('/api/inventory', requirePermission('inventory:write'), (req, res) => {
      res.json({ success: true, item: req.body });
    });

    app.put('/api/inventory/:id', requirePermission('inventory:write'), (req, res) => {
      res.json({ success: true, id: req.params.id });
    });

    app.delete('/api/inventory/:id', requirePermission('inventory:delete'), (req, res) => {
      res.json({ success: true, id: req.params.id });
    });

    app.get('/api/admin/users', requirePermission('admin:users'), (req, res) => {
      res.json({ users: [] });
    });

    app.post('/api/admin/permissions', requirePermission('admin:permissions'), (req, res) => {
      res.json({ success: true });
    });

    server = createServer(app);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Authentication Requirements', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should accept authenticated requests', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .set('Authorization', 'Bearer user')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.user).toBe('user@test.com');
    });
  });

  describe('Permission-Based Access', () => {
    it('should allow read operations for users with read permission', async () => {
      const users = ['admin', 'user', 'readonly'];
      
      for (const user of users) {
        const response = await request(app)
          .get('/api/inventory')
          .set('Authorization', `Bearer ${user}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
      }
    });

    it('should deny write operations for read-only users', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Authorization', 'Bearer readonly')
        .send({ name: 'Test Item', quantity: 10 })
        .expect(403);

      expect(response.body.error).toMatch(/forbidden|insufficient permissions/i);
    });

    it('should allow write operations for users with write permission', async () => {
      const authorizedUsers = ['admin', 'user'];
      
      for (const user of authorizedUsers) {
        const response = await request(app)
          .post('/api/inventory')
          .set('Authorization', `Bearer ${user}`)
          .send({ name: 'Test Item', quantity: 10 })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    it('should restrict delete operations to authorized users', async () => {
      // Only admin should have delete permission
      const response = await request(app)
        .delete('/api/inventory/123')
        .set('Authorization', 'Bearer user')
        .expect(403);

      expect(response.body.error).toMatch(/forbidden|insufficient permissions/i);

      // Admin should be able to delete
      const adminResponse = await request(app)
        .delete('/api/inventory/123')
        .set('Authorization', 'Bearer admin')
        .expect(200);

      expect(adminResponse.body.success).toBe(true);
    });
  });

  describe('Admin Access Control', () => {
    it('should restrict admin endpoints to admin users', async () => {
      const nonAdminUsers = ['user', 'readonly'];
      
      for (const user of nonAdminUsers) {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${user}`)
          .expect(403);

        expect(response.body.error).toMatch(/forbidden|insufficient permissions/i);
      }
    });

    it('should allow admin access to all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/inventory' },
        { method: 'post', path: '/api/inventory' },
        { method: 'delete', path: '/api/inventory/123' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'post', path: '/api/admin/permissions' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', 'Bearer admin')
          .send({ test: 'data' });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Data Isolation', () => {
    it('should isolate user data based on permissions', async () => {
      // Mock endpoint that returns user-specific data
      app.get('/api/user/inventory', (req: any, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Return only user's own inventory
        res.json({
          items: [],
          userId: req.user.id,
          userEmail: req.user.email,
        });
      });

      const response1 = await request(app)
        .get('/api/user/inventory')
        .set('Authorization', 'Bearer user');

      const response2 = await request(app)
        .get('/api/user/inventory')
        .set('Authorization', 'Bearer readonly');

      expect(response1.body.userId).toBe('2');
      expect(response2.body.userId).toBe('3');
      expect(response1.body.userId).not.toBe(response2.body.userId);
    });

    it('should prevent accessing other users data', async () => {
      app.get('/api/users/:userId/data', (req: any, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if user is accessing their own data or is admin
        if (req.params.userId !== req.user.id && !req.user.permissions.includes('admin:all')) {
          return res.status(403).json({ error: 'Forbidden: Cannot access other user data' });
        }
        
        res.json({ data: 'sensitive user data' });
      });

      // User trying to access another user's data
      const response = await request(app)
        .get('/api/users/1/data')
        .set('Authorization', 'Bearer user')
        .expect(403);

      expect(response.body.error).toMatch(/cannot access other user data/i);

      // User accessing their own data
      const ownDataResponse = await request(app)
        .get('/api/users/2/data')
        .set('Authorization', 'Bearer user')
        .expect(200);

      expect(ownDataResponse.body.data).toBeDefined();

      // Admin can access any user's data
      const adminResponse = await request(app)
        .get('/api/users/2/data')
        .set('Authorization', 'Bearer admin')
        .expect(200);

      expect(adminResponse.body.data).toBeDefined();
    });
  });

  describe('Permission Escalation Prevention', () => {
    it('should not allow users to grant themselves permissions', async () => {
      app.post('/api/users/:userId/permissions', (req: any, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Only admins can modify permissions
        if (!req.user.permissions.includes('admin:permissions')) {
          return res.status(403).json({ error: 'Forbidden: Cannot modify permissions' });
        }
        
        // Prevent self-permission escalation
        if (req.params.userId === req.user.id && !req.user.permissions.includes('admin:all')) {
          return res.status(403).json({ error: 'Forbidden: Cannot modify own permissions' });
        }
        
        res.json({ success: true });
      });

      // Regular user trying to modify permissions
      const response = await request(app)
        .post('/api/users/2/permissions')
        .set('Authorization', 'Bearer user')
        .send({ permissions: ['admin:all'] })
        .expect(403);

      expect(response.body.error).toMatch(/cannot modify permissions/i);
    });

    it('should validate permission format and values', async () => {
      const validPermissions = [
        'inventory:read',
        'inventory:write',
        'inventory:delete',
        'admin:users',
        'admin:permissions',
      ];

      const invalidPermissions = [
        'invalid:permission',
        'admin:*',
        'inventory:admin',
        'superuser',
        '',
      ];

      // Mock validation function
      const isValidPermission = (permission: string): boolean => {
        return validPermissions.includes(permission);
      };

      for (const perm of invalidPermissions) {
        expect(isValidPermission(perm)).toBe(false);
      }

      for (const perm of validPermissions) {
        expect(isValidPermission(perm)).toBe(true);
      }
    });
  });

  describe('Role-Based Access Control', () => {
    it('should map roles to permissions correctly', () => {
      const rolePermissionMap = {
        admin: ['inventory:read', 'inventory:write', 'inventory:delete', 'admin:all'],
        manager: ['inventory:read', 'inventory:write', 'inventory:delete'],
        operator: ['inventory:read', 'inventory:write'],
        viewer: ['inventory:read'],
      };

      // Test role hierarchy
      expect(rolePermissionMap.admin.length).toBeGreaterThan(rolePermissionMap.manager.length);
      expect(rolePermissionMap.manager.length).toBeGreaterThan(rolePermissionMap.operator.length);
      expect(rolePermissionMap.operator.length).toBeGreaterThan(rolePermissionMap.viewer.length);

      // Test permission inheritance
      expect(rolePermissionMap.admin).toContain('inventory:read');
      expect(rolePermissionMap.manager).toContain('inventory:read');
      expect(rolePermissionMap.operator).toContain('inventory:read');
      expect(rolePermissionMap.viewer).toContain('inventory:read');
    });

    it('should enforce resource-level permissions', async () => {
      app.get('/api/warehouses/:warehouseId/inventory', (req: any, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if user has access to specific warehouse
        const userWarehouses = req.user.warehouses || [];
        if (!userWarehouses.includes(req.params.warehouseId) && !req.user.permissions.includes('admin:all')) {
          return res.status(403).json({ error: 'Forbidden: No access to this warehouse' });
        }
        
        res.json({ inventory: [] });
      });

      // User without warehouse access
      const response = await request(app)
        .get('/api/warehouses/warehouse-123/inventory')
        .set('Authorization', 'Bearer user')
        .expect(403);

      expect(response.body.error).toMatch(/no access to this warehouse/i);
    });
  });
});