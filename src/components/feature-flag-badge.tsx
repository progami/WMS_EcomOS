'use client';

import { Badge } from '@/components/ui/badge';
import { useFeatureFlag, FEATURE_FLAGS } from '@/hooks/useFeatureFlag';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FeatureFlagBadgeProps {
  flagName: string;
  className?: string;
}

export function FeatureFlagBadge({ flagName, className }: FeatureFlagBadgeProps) {
  const { enabled, source, loading } = useFeatureFlag(flagName);

  if (loading || !enabled) return null;

  const getSourceLabel = () => {
    switch (source) {
      case 'percentage':
        return 'Rollout';
      case 'user':
        return 'User';
      case 'role':
        return 'Role';
      case 'environment':
        return 'Env';
      default:
        return 'Beta';
    }
  };

  const getTooltipContent = () => {
    switch (source) {
      case 'percentage':
        return 'This feature is being gradually rolled out';
      case 'user':
        return 'This feature is enabled specifically for you';
      case 'role':
        return 'This feature is enabled for your role';
      case 'environment':
        return 'This feature is enabled in this environment';
      default:
        return 'This is a beta feature';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={className}>
            <Info className="h-3 w-3 mr-1" />
            {getSourceLabel()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ModernInventoryBadge() {
  return <FeatureFlagBadge flagName={FEATURE_FLAGS.MODERN_INVENTORY_API} />;
}

export function OptimizedDashboardBadge() {
  return <FeatureFlagBadge flagName={FEATURE_FLAGS.OPTIMIZED_DASHBOARD} />;
}

export function EnhancedSecurityBadge() {
  return <FeatureFlagBadge flagName={FEATURE_FLAGS.ENHANCED_SECURITY} />;
}

export function PermissionSystemBadge() {
  return <FeatureFlagBadge flagName={FEATURE_FLAGS.PERMISSION_SYSTEM} />;
}