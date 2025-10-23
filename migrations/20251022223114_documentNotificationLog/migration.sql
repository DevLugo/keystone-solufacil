-- CreateTable
CREATE TABLE "DocumentNotificationLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL DEFAULT '',
    "documentType" TEXT NOT NULL DEFAULT '',
    "personalDataId" TEXT NOT NULL DEFAULT '',
    "personName" TEXT NOT NULL DEFAULT '',
    "loanId" TEXT NOT NULL DEFAULT '',
    "routeId" TEXT NOT NULL DEFAULT '',
    "routeName" TEXT NOT NULL DEFAULT '',
    "localityName" TEXT NOT NULL DEFAULT '',
    "routeLeadId" TEXT NOT NULL DEFAULT '',
    "routeLeadName" TEXT NOT NULL DEFAULT '',
    "routeLeadUserId" TEXT NOT NULL DEFAULT '',
    "telegramUserId" TEXT NOT NULL DEFAULT '',
    "telegramChatId" TEXT NOT NULL DEFAULT '',
    "telegramUsername" TEXT NOT NULL DEFAULT '',
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "messageContent" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "telegramResponse" TEXT NOT NULL DEFAULT '',
    "telegramErrorCode" INTEGER,
    "telegramErrorMessage" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "responseTimeMs" INTEGER,
    "retryCount" INTEGER DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentNotificationLog_status_idx" ON "DocumentNotificationLog"("status");

-- CreateIndex
CREATE INDEX "DocumentNotificationLog_issueType_idx" ON "DocumentNotificationLog"("issueType");

-- CreateIndex
CREATE INDEX "DocumentNotificationLog_createdAt_idx" ON "DocumentNotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentNotificationLog_telegramChatId_idx" ON "DocumentNotificationLog"("telegramChatId");

-- CreateIndex
CREATE INDEX "DocumentNotificationLog_documentId_idx" ON "DocumentNotificationLog"("documentId");

-- CreateIndex
CREATE INDEX "DocumentNotificationLog_personName_idx" ON "DocumentNotificationLog"("personName");

-- CreateIndex
CREATE INDEX "DocumentNotificationLog_routeName_idx" ON "DocumentNotificationLog"("routeName");

-- AddForeignKey
ALTER TABLE "DocumentNotificationLog" ADD CONSTRAINT "DocumentNotificationLog_personalDataId_fkey" FOREIGN KEY ("personalDataId") REFERENCES "PersonalData"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNotificationLog" ADD CONSTRAINT "DocumentNotificationLog_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNotificationLog" ADD CONSTRAINT "DocumentNotificationLog_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNotificationLog" ADD CONSTRAINT "DocumentNotificationLog_routeLeadId_fkey" FOREIGN KEY ("routeLeadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNotificationLog" ADD CONSTRAINT "DocumentNotificationLog_routeLeadUserId_fkey" FOREIGN KEY ("routeLeadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNotificationLog" ADD CONSTRAINT "DocumentNotificationLog_telegramUserId_fkey" FOREIGN KEY ("telegramUserId") REFERENCES "TelegramUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
