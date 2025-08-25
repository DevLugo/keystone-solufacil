-- CreateEnum
CREATE TYPE "DocumentPhotoDocumentTypeType" AS ENUM ('INE', 'DOMICILIO', 'PAGARE', 'OTRO');

-- CreateTable
CREATE TABLE "DocumentPhoto" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "documentType" "DocumentPhotoDocumentTypeType" NOT NULL,
    "personalData" TEXT,
    "loan" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentPhoto_personalData_idx" ON "DocumentPhoto"("personalData");

-- CreateIndex
CREATE INDEX "DocumentPhoto_loan_idx" ON "DocumentPhoto"("loan");

-- CreateIndex
CREATE INDEX "DocumentPhoto_uploadedBy_idx" ON "DocumentPhoto"("uploadedBy");

-- AddForeignKey
ALTER TABLE "DocumentPhoto" ADD CONSTRAINT "DocumentPhoto_personalData_fkey" FOREIGN KEY ("personalData") REFERENCES "PersonalData"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPhoto" ADD CONSTRAINT "DocumentPhoto_loan_fkey" FOREIGN KEY ("loan") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPhoto" ADD CONSTRAINT "DocumentPhoto_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
