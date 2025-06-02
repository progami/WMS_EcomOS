# Warehouse Management System

A comprehensive warehouse management solution that tracks inventory, calculates storage costs, and manages billing across multiple 3PL warehouses. Built as a web-based replacement for complex Excel spreadsheets, maintaining the same business logic with improved scalability and real-time capabilities.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up database
cp .env.example .env
# Edit .env with your database URL

# Run database setup
npm run db:push
npm run db:seed

# Import existing Excel data (optional)
npm run db:import

# Start the app
npm run dev
```

Visit http://localhost:3000

## 📁 Project Structure

```
warehouse_management/
├── src/                    # Application source code
│   ├── app/               # Next.js app directory (pages & API routes)
│   ├── components/        # React components
│   ├── lib/              # Core business logic
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Helper functions
├── prisma/                # Database schema and migrations
├── scripts/               # Utility scripts for data management
├── docs/                  # Documentation
│   ├── architecture/     # System architecture docs
│   ├── setup/           # Setup guides
│   └── excel-templates/ # Original Excel system docs
├── tests/                 # Test suite
├── public/               # Static assets
└── data/                 # Excel data and import scripts
```

## 🔑 Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@warehouse.com | admin123 |
| Finance | finance@warehouse.com | admin123 |
| Warehouse Staff | staff@warehouse.com | admin123 |

## 📈 Current Data Status

✅ **Imported from Excel (May 2024 - May 2025):**
- 174 inventory transactions (33 RECEIVE, 141 SHIP)
- 8 SKUs with full specifications
- 18 warehouse-SKU configurations  
- 31 cost rates (inbound, storage, outbound)
- Current inventory balances calculated

⏳ **Pending Implementation:**
- Storage ledger calculations
- Cost calculations and billing reports
- Invoice reconciliation features

## 📱 Features by Role

### Admin Features
- User management and permissions
- System settings and configuration
- SKU and warehouse management
- View all reports and analytics

### Finance Features
- Invoice processing and upload
- Cost reconciliation
- Storage rate management
- Financial reports and analytics

### Warehouse Staff Features
- Inventory tracking
- Receiving and shipping
- Real-time stock levels
- Operational reports

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI Components**: Radix UI, shadcn/ui
- **Charts**: Recharts
- **Excel Processing**: xlsx

## 📊 Key Features

- **Transaction-Based Ledger**: All inventory movements tracked as immutable transactions (RECEIVE, SHIP, ADJUST)
- **Real-time Balance Calculation**: Current inventory calculated from complete transaction history
- **Weekly Storage Billing**: Automated Monday stock-takes for 3PL billing (industry standard)
- **Multi-warehouse Management**: Track inventory across FMC, VGLOBAL, 4AS, and other locations
- **Batch/Lot Tracking**: Full traceability with Warehouse + SKU + Batch/Lot identification
- **Invoice Reconciliation**: Compare actual vs calculated costs with variance analysis
- **Role-based Access**: Secure access control for Admin, Finance, and Warehouse Staff
- **Excel Import/Export**: Seamless data migration from existing Excel systems
- **Audit Trail**: Complete history of all transactions and modifications

## 🔧 Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Open Prisma Studio
npm run db:studio

# Type checking
npm run type-check
```

## 📦 Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/warehouse_db"

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Optional
NODE_ENV="production"
```

## 📚 Documentation

- [Architecture Overview](./docs/architecture/web-app-architecture.md)
- [Database Schema](./docs/architecture/database-schema-optimized.sql)
- [Setup Guide](./docs/setup/quick-start.md)
- [Excel Templates](./docs/excel-templates/) - Original Excel system documentation
- [Test Coverage Report](./docs/test-coverage-report.md)

## 🏢 Business Rules

1. **Billing Periods**: 16th of previous month to 15th of current month
2. **Stock-Take Day**: Monday 23:59:59 (3PL industry standard)
3. **Inventory Tracking**: Every item tracked by Warehouse + SKU + Batch/Lot
4. **No Negative Inventory**: System prevents shipping more than available
5. **Audit Trail**: All transactions preserved, corrections added as new transactions

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.