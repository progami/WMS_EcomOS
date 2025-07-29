'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Database, Trash2, CheckCircle, AlertCircle } from '@/lib/lucide-icons'
import { useToast } from '@/components/ui/use-toast'

export function DemoDataManager() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [demoStats, setDemoStats] = useState<any>(null)
  const { toast } = useToast()

  // Check demo data status on mount
  useEffect(() => {
    checkDemoStatus()
  }, [])

  // Poll for progress when generating
  useEffect(() => {
    if (!sessionId || !isGenerating) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'progress', sessionId })
        })
        
        const data = await response.json()
        
        if (data.progress !== undefined) {
          setProgress(data.progress)
          setProgressMessage(data.message)
          
          if (data.progress === 100) {
            setIsGenerating(false)
            setSessionId(null)
            toast({
              title: 'Success',
              description: 'Demo data generated successfully!'
            })
            checkDemoStatus()
          } else if (data.progress === -1) {
            setIsGenerating(false)
            setSessionId(null)
            toast({
              title: 'Error',
              description: data.message || 'Failed to generate demo data',
              variant: 'destructive'
            })
          }
        }
      } catch (error) {
        // console.error('Error checking progress:', error)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionId, isGenerating, toast])

  const checkDemoStatus = async () => {
    try {
      const response = await fetch('/api/demo')
      if (response.ok) {
        const stats = await response.json()
        setDemoStats(stats)
      }
    } catch (error) {
      // console.error('Error checking demo status:', error)
    }
  }

  const handleGenerate = async () => {
    try {
      setIsGenerating(true)
      setProgress(0)
      setProgressMessage('Starting demo data generation...')
      
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start demo data generation')
      }
      
      const data = await response.json()
      setSessionId(data.sessionId)
    } catch (error) {
      // console.error('Error generating demo data:', error)
      setIsGenerating(false)
      toast({
        title: 'Error',
        description: 'Failed to start demo data generation',
        variant: 'destructive'
      })
    }
  }

  const handleClear = async () => {
    try {
      setIsClearing(true)
      
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      })
      
      if (!response.ok) {
        throw new Error('Failed to clear demo data')
      }
      
      toast({
        title: 'Success',
        description: 'Demo data cleared successfully'
      })
      
      checkDemoStatus()
    } catch (error) {
      // console.error('Error clearing demo data:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear demo data',
        variant: 'destructive'
      })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo Data Manager</CardTitle>
        <CardDescription>
          Generate comprehensive demo data to explore all features of the WMS system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {demoStats && (
          <Alert className={demoStats.hasData ? '' : 'border-orange-200 bg-orange-50'}>
            <AlertDescription>
              {demoStats.hasData ? (
                <div className="space-y-1">
                  <p className="font-medium">Current demo data:</p>
                  <ul className="text-sm space-y-0.5 ml-4">
                    <li>• {demoStats.warehouses} warehouses</li>
                    <li>• {demoStats.users} users</li>
                    <li>• {demoStats.skus} SKUs</li>
                    <li>• {demoStats.transactions} transactions</li>
                    <li>• {demoStats.invoices} invoices</li>
                  </ul>
                </div>
              ) : (
                <p>No demo data found. Generate demo data to explore the system.</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{progressMessage}</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex gap-4">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || isClearing}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Generate Demo Data
              </>
            )}
          </Button>
          
          <Button
            onClick={handleClear}
            disabled={isGenerating || isClearing || !demoStats?.hasData}
            variant="destructive"
          >
            {isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Data
              </>
            )}
          </Button>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Demo data includes:</strong>
            <ul className="mt-2 text-sm space-y-1">
              <li>• 6 months of historical inventory transactions with seasonal patterns</li>
              <li>• Realistic customer types (FBA sellers, retailers, wholesalers)</li>
              <li>• Amazon FBA integration data and shipments</li>
              <li>• Pallet variance records and investigations</li>
              <li>• Invoice disputes and resolutions</li>
              <li>• Warehouse notifications and alerts</li>
              <li>• File attachments for invoices</li>
              <li>• Comprehensive cost calculations</li>
              <li>• Payment records and audit logs</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}