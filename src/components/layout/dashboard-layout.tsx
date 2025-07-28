import { MainNav } from './main-nav'
import { Breadcrumb } from '@/components/ui/breadcrumb'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MainNav />
      <div className="md:pl-16 lg:pl-64 transition-all duration-300">
        <main className="py-6 sm:py-8 md:py-10">
          <div className="px-4 sm:px-6 md:px-8">
            <Breadcrumb />
            {children}
          </div>
        </main>
      </div>
    </>
  )
}