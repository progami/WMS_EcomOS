# WMS - Warehouse Management System

![Deploy Status](https://github.com/progami/WMS_EcomOS/actions/workflows/deploy.yml/badge.svg)

Modern 3PL warehouse management system with inventory tracking, billing automation, and multi-warehouse support.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Recharts
- **Backend**: Next.js API Routes, Prisma ORM, PostgreSQL  
- **Auth**: NextAuth.js with environment-based security
- **Deployment**: AWS EC2/RDS, PM2, Nginx

## Quick Start

```bash
# Clone and install
git clone [your-repo-url]
cd WMS
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your database and AWS S3 credentials
# See docs/s3-configuration.md for S3 setup guide

# Initialize database
npm run db:push
npm run db:seed  # Optional demo data

# Start development
npm run dev
```

## Features

- **Multi-warehouse** inventory management with real-time tracking
- **Automated billing** with storage calculation and invoicing
- **Dashboard analytics** with market, operations, and finance insights
- **Role-based access** control (Admin, Manager, Staff)
- **Excel/CSV** import/export for bulk operations
- **Audit trail** for all inventory movements
- **Production-ready** with security hardening and deployment scripts

## Deployment

```bash
# Infrastructure provisioning and deployment
cd infrastructure
make deploy-prod  # Deploy to production
```

The project uses Terraform for infrastructure provisioning and Ansible for application deployment.
See [AWS Deployment Guide](./docs/AWS_FREE_TIER_DEPLOYMENT.md) for detailed instructions.

## Project Structure

```
WMS/
├── src/              # Application source code
├── prisma/           # Database schema
├── infrastructure/   # Terraform and Ansible deployment
├── docs/             # Documentation
└── scripts/          # Utility scripts
```

## Default Users

Development mode includes quick-fill authentication. Production requires environment variables:
- `DEMO_ADMIN_PASSWORD` 
- `DEMO_STAFF_PASSWORD`

## License

Proprietary software. All rights reserved.# Test
