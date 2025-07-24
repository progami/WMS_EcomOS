import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import WarehouseConfigsClientPage from './client-page'

export default async function WarehouseConfigsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    redirect('/auth/login')
  }

  // Get all warehouse-SKU configurations with related data
  const configs = await prisma.warehouseSkuConfig.findMany({
    include: {
      warehouse: true,
      sku: true,
      createdBy: {
        select: {
          fullName: true,
          email: true
        }
      }
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { sku: { skuCode: 'asc' } },
      { effectiveDate: 'desc' }
    ]
  })

  // Group configs by warehouse
  const configsByWarehouse = configs.reduce((acc, config) => {
    const warehouseName = config.warehouse.name
    if (!acc[warehouseName]) {
      acc[warehouseName] = []
    }
    acc[warehouseName].push(config)
    return acc
  }, {} as Record<string, typeof configs>)

  // Get summary stats
  const totalConfigs = configs.length
  const activeConfigs = configs.filter(c => !c.endDate || new Date(c.endDate) > new Date()).length
  const uniqueSkus = new Set(configs.map(c => c.skuId)).size
  const warehouses = Object.keys(configsByWarehouse).length

  const stats = {
    totalConfigs,
    activeConfigs,
    uniqueSkus,
    warehouses
  }

  // Convert dates to strings for client component
  const configsForClient = configs.map(config => ({
    ...config,
    effectiveDate: config.effectiveDate.toISOString(),
    endDate: config.endDate ? config.endDate.toISOString() : null,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString()
  }))

  const configsByWarehouseForClient = Object.entries(configsByWarehouse).reduce<Record<string, any[]>>((acc, [key, value]) => {
    acc[key] = (value as typeof configs).map(config => ({
      ...config,
      effectiveDate: config.effectiveDate.toISOString(),
      endDate: config.endDate ? config.endDate.toISOString() : null,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
    }))
    return acc
  }, {})

  return (
    <DashboardLayout>
      <WarehouseConfigsClientPage 
        configs={configsForClient}
        configsByWarehouse={configsByWarehouseForClient}
        stats={stats}
      />
    </DashboardLayout>
  )
}