-- Migration to add User-Employee relationship
-- This migration adds the direct relationship between User and Employee tables

-- Add userId column to Employee table
ALTER TABLE "Employee" ADD COLUMN "user" TEXT;

-- Create unique index on userId (one employee per user)
CREATE UNIQUE INDEX "Employee_user_key" ON "Employee"("user");

-- Create index for performance
CREATE INDEX "Employee_user_idx" ON "Employee"("user");

-- Add foreign key constraint
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional: Update existing records based on name matching
-- This is commented out as it should be done carefully with the script
-- UPDATE "Employee" SET "user" = (
--   SELECT u.id FROM "User" u 
--   WHERE u.name = (
--     SELECT pd.fullName FROM "PersonalData" pd 
--     WHERE pd.id = "Employee".personalData
--   )
-- );

COMMENT ON COLUMN "Employee"."user" IS 'Direct relationship to User - allows a User to be linked to an Employee for dashboard access';