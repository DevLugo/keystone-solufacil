/*
  Warnings:

  - You are about to drop the column `avalName` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `avalPhone` on the `Loan` table. All the data in the column will be lost.
  - You are about to alter the column `rate` on the `Loantype` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,4)` to `Decimal(10,2)`.
  - A unique constraint covering the columns `[clientCode]` on the table `PersonalData` will be added. If there are existing duplicate values, this will fail.
  - Made the column `rate` on table `Loantype` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "avalName",
DROP COLUMN "avalPhone",
ADD COLUMN     "excludedByCleanup" TEXT,
ADD COLUMN     "expectedWeeklyPayment" DECIMAL(12,2),
ADD COLUMN     "pendingAmountStored" DECIMAL(12,2),
ADD COLUMN     "renewedDate" TIMESTAMP(3),
ADD COLUMN     "totalDebtAcquired" DECIMAL(12,2),
ADD COLUMN     "totalPaid" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Loantype" ADD COLUMN     "loanGrantedComission" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "loanPaymentComission" DECIMAL(10,2) DEFAULT 0,
ALTER COLUMN "rate" SET NOT NULL,
ALTER COLUMN "rate" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "PersonalData" ADD COLUMN     "clientCode" TEXT;

-- CreateTable
CREATE TABLE "PortfolioCleanup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "cleanupDate" TIMESTAMP(3) NOT NULL,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "excludedLoansCount" INTEGER,
    "excludedAmount" DECIMAL(18,4),
    "route" TEXT,
    "executedBy" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "PortfolioCleanup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Loan_collaterals" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "PortfolioCleanup_route_idx" ON "PortfolioCleanup"("route");

-- CreateIndex
CREATE INDEX "PortfolioCleanup_executedBy_idx" ON "PortfolioCleanup"("executedBy");

-- CreateIndex
CREATE UNIQUE INDEX "_Loan_collaterals_AB_unique" ON "_Loan_collaterals"("A", "B");

-- CreateIndex
CREATE INDEX "_Loan_collaterals_B_index" ON "_Loan_collaterals"("B");

-- CreateIndex
CREATE INDEX "Loan_excludedByCleanup_idx" ON "Loan"("excludedByCleanup");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalData_clientCode_key" ON "PersonalData"("clientCode");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_excludedByCleanup_fkey" FOREIGN KEY ("excludedByCleanup") REFERENCES "PortfolioCleanup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCleanup" ADD CONSTRAINT "PortfolioCleanup_route_fkey" FOREIGN KEY ("route") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCleanup" ADD CONSTRAINT "PortfolioCleanup_executedBy_fkey" FOREIGN KEY ("executedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Loan_collaterals" ADD CONSTRAINT "_Loan_collaterals_A_fkey" FOREIGN KEY ("A") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Loan_collaterals" ADD CONSTRAINT "_Loan_collaterals_B_fkey" FOREIGN KEY ("B") REFERENCES "PersonalData"("id") ON DELETE CASCADE ON UPDATE CASCADE;
