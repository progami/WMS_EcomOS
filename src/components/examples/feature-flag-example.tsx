'use client';

import { useFeatureFlag, FEATURE_FLAGS } from '@/hooks/useFeatureFlag';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { ModernInventoryBadge } from '@/components/feature-flag-badge';

/**
 * Example component showing how to use feature flags
 */
export function FeatureFlagExample() {
  // Check if the modern inventory API is enabled
  const { enabled, source, loading, error } = useFeatureFlag(FEATURE_FLAGS.MODERN_INVENTORY_API);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to check feature flag status. Using default behavior.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Inventory Management</CardTitle>
          <ModernInventoryBadge />
        </div>
        <CardDescription>
          {enabled 
            ? `Using modern inventory API (source: ${source})`
            : 'Using standard inventory API'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <ModernInventoryComponent />
        ) : (
          <StandardInventoryComponent />
        )}
      </CardContent>
    </Card>
  );
}

// Modern implementation with new features
function ModernInventoryComponent() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Modern Inventory View</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Real-time inventory updates</li>
        <li>Advanced filtering and search</li>
        <li>Batch operations support</li>
        <li>Performance optimizations</li>
      </ul>
    </div>
  );
}

// Standard implementation
function StandardInventoryComponent() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Standard Inventory View</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Basic inventory management</li>
        <li>Standard search functionality</li>
        <li>Single item operations</li>
      </ul>
    </div>
  );
}