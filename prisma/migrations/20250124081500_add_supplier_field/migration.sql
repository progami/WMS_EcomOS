-- AlterTable - Add supplier column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_transactions' 
        AND column_name = 'supplier'
    ) THEN
        ALTER TABLE "inventory_transactions" ADD COLUMN "supplier" TEXT;
    END IF;
END $$;