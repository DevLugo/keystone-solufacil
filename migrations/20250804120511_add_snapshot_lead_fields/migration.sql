-- Agregar campos de snapshot del líder al modelo Loan (solo si no existen)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Loan' AND column_name = 'snapshotLeadId') THEN
        ALTER TABLE "Loan" ADD COLUMN "snapshotLeadId" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Loan' AND column_name = 'snapshotLeadName') THEN
        ALTER TABLE "Loan" ADD COLUMN "snapshotLeadName" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Loan' AND column_name = 'snapshotLeadAssignedAt') THEN
        ALTER TABLE "Loan" ADD COLUMN "snapshotLeadAssignedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Agregar campos de snapshot del líder al modelo Transaction (solo si no existen)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'snapshotLeadId') THEN
        ALTER TABLE "Transaction" ADD COLUMN "snapshotLeadId" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'snapshotLeadName') THEN
        ALTER TABLE "Transaction" ADD COLUMN "snapshotLeadName" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'snapshotLeadAssignedAt') THEN
        ALTER TABLE "Transaction" ADD COLUMN "snapshotLeadAssignedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Agregar campos de snapshot de localidad y ruta al modelo Loan (solo si no existen)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Loan' AND column_name = 'snapshotLocationId') THEN
        ALTER TABLE "Loan" ADD COLUMN "snapshotLocationId" TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Loan' AND column_name = 'snapshotLocationName') THEN
        ALTER TABLE "Loan" ADD COLUMN "snapshotLocationName" TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Loan' AND column_name = 'snapshotRouteId') THEN
        ALTER TABLE "Loan" ADD COLUMN "snapshotRouteId" TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Loan' AND column_name = 'snapshotRouteName') THEN
        ALTER TABLE "Loan" ADD COLUMN "snapshotRouteName" TEXT DEFAULT '';
    END IF;
END $$;

-- Agregar campos de snapshot de localidad y ruta al modelo Transaction (solo si no existen)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'snapshotLocationId') THEN
        ALTER TABLE "Transaction" ADD COLUMN "snapshotLocationId" TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'snapshotLocationName') THEN
        ALTER TABLE "Transaction" ADD COLUMN "snapshotLocationName" TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'snapshotRouteId') THEN
        ALTER TABLE "Transaction" ADD COLUMN "snapshotRouteId" TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'snapshotRouteName') THEN
        ALTER TABLE "Transaction" ADD COLUMN "snapshotRouteName" TEXT DEFAULT '';
    END IF;
END $$; 