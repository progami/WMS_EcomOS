import React from 'react'
import { ArrowRight } from '@/lib/lucide-icons'

interface WorkflowStep {
  title: string
  description: string
  group: 'outbound' | 'inbound' | 'reporting'
}

const workflowSteps: WorkflowStep[] = [
  {
    title: 'Shipment Planning',
    description: 'Plan optimal shipments',
    group: 'outbound'
  },
  {
    title: 'Ship Goods',
    description: 'Process outbound orders',
    group: 'outbound'
  },
  {
    title: 'Receive Goods',
    description: 'Record incoming inventory',
    group: 'inbound'
  },
  {
    title: 'Inventory Ledger',
    description: 'Track all transactions',
    group: 'reporting'
  },
  {
    title: 'Import Attributes',
    description: 'Bulk update data',
    group: 'reporting'
  },
  {
    title: 'Pallet Variance',
    description: 'Resolve discrepancies',
    group: 'reporting'
  }
]

const groupColors = {
  outbound: 'bg-purple-100 text-purple-700 border-purple-300',
  inbound: 'bg-green-100 text-green-700 border-green-300',
  reporting: 'bg-blue-100 text-blue-700 border-blue-300'
}

export function OperationsWorkflowHeader() {
  return (
    <div className="mb-8 p-6 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-semibold mb-4">Operations Workflow</h2>
      <div className="flex flex-wrap items-center gap-2">
        {workflowSteps.map((step, index) => (
          <React.Fragment key={step.title}>
            <div className={`px-4 py-2 rounded-lg border ${groupColors[step.group]}`}>
              <div className="font-medium text-sm">{step.title}</div>
              <div className="text-xs opacity-80">{step.description}</div>
            </div>
            {index < workflowSteps.length - 1 && (
              <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-4 flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-gray-600">Outbound Operations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600">Inbound Operations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-600">Reporting & Management</span>
        </div>
      </div>
    </div>
  )
}