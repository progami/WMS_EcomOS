import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Package2, Info } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import type { InventoryTransaction, User } from '@prisma/client'

export default async function BatchAttributesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  // Get all batches with their attributes from inventory balances and initial transactions
  const batches = await prisma.inventoryBalance.findMany({
    where: {
      currentCartons: { gt: 0 } // Only show active batches
    },
    include: {
      warehouse: {
        select: {
          name: true,
          code: true
        }
      },
      sku: {
        select: {
          skuCode: true,
          description: true,
          unitsPerCarton: true // Current value for reference
        }
      }
    },
    orderBy: [
      { sku: { skuCode: 'asc' } },
      { batchLot: 'asc' }
    ]
  })

  // Get the initial RECEIVE transactions to see who entered the data
  const receiveTransactions = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: 'RECEIVE',
      batchLot: { in: batches.map(b => b.batchLot) },
      skuId: { in: batches.map(b => b.skuId) }
    },
    include: {
      createdBy: {
        select: {
          fullName: true
        }
      }
    },
    orderBy: {
      transactionDate: 'asc'
    }
  })

  // Create lookup map
  const transactionMap = new Map<string, InventoryTransaction & { createdBy: User | null }>(
    receiveTransactions.map(t => [`${t.skuId}-${t.batchLot}`, t])
  )

  // Combine data
  const batchData = batches.map(batch => {
    const transaction = transactionMap.get(`${batch.skuId}-${batch.batchLot}`)
    return {
      ...batch,
      receivedBy: transaction?.createdBy?.fullName || 'Unknown',
      receiveDate: transaction?.transactionDate || batch.lastTransactionDate,
      transactionUnits: transaction ? (transaction.cartonsIn * batch.sku.unitsPerCarton) : null
    }
  })

  // Group by SKU for better display
  const batchesBySku: Record<string, typeof batchData> = batchData.reduce((acc, batch) => {
    const skuKey = `${batch.sku.skuCode}|${batch.sku.description}`
    if (!acc[skuKey]) {
      acc[skuKey] = []
    }
    acc[skuKey].push(batch)
    return acc
  }, {} as Record<string, typeof batchData>)

  const totalBatches = batches.length
  const uniqueSkus = Object.keys(batchesBySku).length
  const totalCartons = batches.reduce((sum, b) => sum + b.currentCartons, 0)
  const totalUnits = batches.reduce((sum, b) => sum + b.currentUnits, 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Batch Attributes"
          subtitle="View packaging configurations by batch"
          description="This read-only view shows the actual units per carton and pallet configurations for each batch in inventory. These values were captured during receiving and are used for all inventory calculations."
          icon={Package2}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
          textColor="text-blue-800"
        />

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Note on Units per Carton:</p>
              <p>The system currently uses the SKU's configured units/carton value for calculations. In the future, this will be captured per batch during receiving, similar to cartons per pallet. This will allow for packaging variations between batches.</p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-600">Active SKUs</p>
            <p className="text-2xl font-bold">{uniqueSkus}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-600">Active Batches</p>
            <p className="text-2xl font-bold">{totalBatches}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Cartons</p>
            <p className="text-2xl font-bold">{totalCartons.toLocaleString()}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Units</p>
            <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
          </div>
        </div>

        {/* Batch Attributes Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch/Lot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units/Carton
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Storage C/P
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shipping C/P
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(batchesBySku).map(([skuKey, skuBatches]) => {
                const [skuCode, description] = skuKey.split('|')
                return (
                  <>
                    {/* SKU Header Row */}
                    <tr key={skuKey} className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{skuCode}</span>
                          <span className="text-gray-600">- {description}</span>
                        </div>
                      </td>
                    </tr>
                    {/* Batch Rows */}
                    {skuBatches.map((batch: any) => (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {/* Empty - SKU shown in header */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {batch.batchLot}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {batch.warehouse.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {batch.sku.unitsPerCarton}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {batch.storageCartonsPerPallet || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {batch.shippingCartonsPerPallet || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          <div>
                            <div>{batch.currentCartons.toLocaleString()} cartons</div>
                            <div className="text-xs text-gray-500">{batch.currentUnits.toLocaleString()} units</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div>
                            <div>{batch.receivedBy}</div>
                            <div className="text-xs text-gray-500">
                              {batch.receiveDate ? new Date(batch.receiveDate).toLocaleDateString() : '-'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        {batches.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Package2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active batches</h3>
            <p className="mt-1 text-sm text-gray-500">
              Batch attributes will appear here after goods are received.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}