/**
 * Example scheduler configuration for reconciliation jobs
 * 
 * In production, you would typically use a job scheduler like:
 * - Node-cron for simple scheduling
 * - Bull/BullMQ for Redis-based job queues
 * - AWS Lambda scheduled events
 * - Kubernetes CronJobs
 * 
 * This file shows how to set up the reconciliation job with different schedulers.
 */

import { runInventoryReconciliationJob } from './inventory-reconciliation-job';

// Example 1: Using node-cron (install with: npm install node-cron @types/node-cron)
/*
import * as cron from 'node-cron';

export function setupReconciliationSchedule() {
  // Run every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled inventory reconciliation...');
    await runInventoryReconciliationJob({
      notifyOnCompletion: true,
      notifyOnCritical: true,
    });
  });

  // Run every Sunday at 3 AM for weekly comprehensive check
  cron.schedule('0 3 * * 0', async () => {
    console.log('Running weekly comprehensive reconciliation...');
    await runInventoryReconciliationJob({
      notifyOnCompletion: true,
      notifyOnCritical: true,
    });
  });
}
*/

// Example 2: Using BullMQ (install with: npm install bullmq)
/*
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

const reconciliationQueue = new Queue('reconciliation', { connection });

// Add recurring job
export async function setupBullMQSchedule() {
  // Daily reconciliation
  await reconciliationQueue.add(
    'daily-reconciliation',
    { notifyOnCompletion: true },
    {
      repeat: {
        pattern: '0 2 * * *', // Every day at 2 AM
      },
    }
  );

  // Weekly comprehensive check
  await reconciliationQueue.add(
    'weekly-reconciliation',
    { notifyOnCompletion: true, notifyOnCritical: true },
    {
      repeat: {
        pattern: '0 3 * * 0', // Every Sunday at 3 AM
      },
    }
  );
}

// Worker to process jobs
const worker = new Worker(
  'reconciliation',
  async (job) => {
    console.log(`Processing reconciliation job: ${job.name}`);
    return await runInventoryReconciliationJob(job.data);
  },
  { connection }
);
*/

// Example 3: Manual trigger via API endpoint
export async function manualTrigger() {
  try {
    const result = await runInventoryReconciliationJob({
      notifyOnCompletion: true,
      notifyOnCritical: true,
    });
    
    return result;
  } catch (error) {
    console.error('Manual reconciliation failed:', error);
    throw error;
  }
}

// Example 4: Environment-based configuration
export function getScheduleConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
        notifyOnCompletion: true,
        notifyOnCritical: true,
      };
    
    case 'staging':
      return {
        enabled: true,
        schedule: '0 */6 * * *', // Every 6 hours
        notifyOnCompletion: true,
        notifyOnCritical: true,
      };
    
    case 'development':
    default:
      return {
        enabled: false, // Manual trigger only in dev
        schedule: null,
        notifyOnCompletion: false,
        notifyOnCritical: true,
      };
  }
}

// Example 5: Next.js API route for manual trigger
/*
// In /app/api/jobs/reconciliation/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runInventoryReconciliationJob } from '@/lib/jobs/inventory-reconciliation-job';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runInventoryReconciliationJob({
      user_id: session.user.id,
      notifyOnCompletion: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to trigger reconciliation' },
      { status: 500 }
    );
  }
}
*/