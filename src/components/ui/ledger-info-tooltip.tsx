import { Info } from '@/lib/lucide-icons'
import { Tooltip } from './tooltip'

export function LedgerInfoTooltip() {
  return (
    <Tooltip 
      content="Immutable Ledger: Transactions cannot be edited or deleted. Use ADJUST_IN/OUT for corrections."
    >
      <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
    </Tooltip>
  )
}