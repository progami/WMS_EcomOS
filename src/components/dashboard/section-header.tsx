import { LucideIcon } from '@/lib/lucide-icons'

interface SectionHeaderProps {
  title: string
  icon: LucideIcon
  description?: string
}

export function SectionHeader({ title, icon: Icon, description }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
          <Icon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}