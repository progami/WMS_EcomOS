-- Drop the legacy inventory_audit_log table
-- This table has been replaced by the audit_logs table which provides better structure and indexing

-- First, backup any important data if needed (this is a comment for documentation)
-- The new audit_logs table already contains all audit functionality

-- Drop the table
DROP TABLE IF EXISTS "inventory_audit_log";