export { BaseService } from './base.service'
export { InvoiceService } from './invoice.service'
export { WarehouseService } from './warehouse.service'
export { UserService } from './user.service'
export { FinanceService } from './finance.service'
export { ReportService } from './report.service'

// Service factory functions for dependency injection
import { prisma } from '@/lib/prisma'
import { Session } from 'next-auth'
import { InvoiceService } from './invoice.service'
import { WarehouseService } from './warehouse.service'
import { UserService } from './user.service'
import { FinanceService } from './finance.service'
import { ReportService } from './report.service'

export function createInvoiceService(session: Session) {
  return new InvoiceService({ session, prisma })
}

export function createWarehouseService(session: Session) {
  return new WarehouseService({ session, prisma })
}

export function createUserService(session: Session) {
  return new UserService({ session, prisma })
}

export function createFinanceService(session: Session) {
  return new FinanceService({ session, prisma })
}

export function createReportService(session: Session) {
  return new ReportService({ session, prisma })
}