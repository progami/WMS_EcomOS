'use client'

import { Package, BookOpen, Calendar } from 'lucide-react'

interface InventoryTabsProps {
  activeTab: 'balances' | 'transactions' | 'storage'
  onTabChange: (tab: 'balances' | 'transactions' | 'storage') => void
}

export function InventoryTabs({ activeTab, onTabChange }: InventoryTabsProps) {
  const handleTabClick = (tab: 'balances' | 'transactions' | 'storage') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    onTabChange(tab)
  }

  return (
    <div className="bg-white border rounded-lg">
      <div className="border-b">
        <nav className="-mb-px flex" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'balances'}
            onClick={handleTabClick('balances')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'balances'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="h-4 w-4 inline mr-2" />
            Current Balances
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'transactions'}
            onClick={handleTabClick('transactions')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'transactions'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="h-4 w-4 inline mr-2" />
            Inventory Ledger
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'storage'}
            onClick={handleTabClick('storage')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'storage'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Storage Ledger
          </button>
        </nav>
      </div>
    </div>
  )
}