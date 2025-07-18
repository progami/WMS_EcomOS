import { useEffect, useRef } from 'react';
import { clientLogger, measurePerformance } from '@/lib/logger/client';

interface PerformanceMetrics {
  pageLoad?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  timeToInteractive?: number;
}

export function usePerformanceMonitor(pageName: string) {
  const metricsLogged = useRef(false);

  useEffect(() => {
    if (metricsLogged.current || typeof window === 'undefined') return;

    const logMetrics = () => {
      const metrics: PerformanceMetrics = {};

      // Get navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        metrics.pageLoad = navigation.loadEventEnd - navigation.fetchStart;
      }

      // Get paint timing
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          metrics.firstContentfulPaint = entry.startTime;
        }
      });

      // Log the metrics
      clientLogger?.performance('Page Performance', metrics.pageLoad || 0, {
        page: pageName,
        metrics,
        url: window.location.href,
      });

      metricsLogged.current = true;
    };

    // Wait for page load to complete
    if (document.readyState === 'complete') {
      logMetrics();
    } else {
      window.addEventListener('load', logMetrics);
      return () => window.removeEventListener('load', logMetrics);
    }
  }, [pageName]);

  // Return a function to measure custom operations
  return {
    measureOperation: (operationName: string, fn: () => void | Promise<void>) => {
      return measurePerformance(`${pageName}:${operationName}`, fn);
    },
  };
}

// Hook to track user interactions
export function useInteractionTracking() {
  const trackClick = (elementName: string, metadata?: any) => {
    clientLogger?.action('Element clicked', {
      element: elementName,
      timestamp: Date.now(),
      ...metadata,
    });
  };

  const trackFormSubmit = (formName: string, metadata?: any) => {
    clientLogger?.action('Form submitted', {
      form: formName,
      timestamp: Date.now(),
      ...metadata,
    });
  };

  const trackNavigation = (from: string, to: string, metadata?: any) => {
    clientLogger?.navigation(from, to, metadata);
  };

  return {
    trackClick,
    trackFormSubmit,
    trackNavigation,
  };
}

// Hook to track API calls
export function useApiTracking() {
  const trackApiCall = async (
    method: string,
    endpoint: string,
    fn: () => Promise<Response>
  ): Promise<Response> => {
    const startTime = performance.now();
    
    try {
      const response = await fn();
      const duration = performance.now() - startTime;
      
      clientLogger?.api(method, endpoint, response.status, duration);
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      clientLogger?.api(method, endpoint, 0, duration, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  };

  return { trackApiCall };
}