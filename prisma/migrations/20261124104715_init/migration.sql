-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'APPROVER', 'STAFF');

-- CreateEnum
CREATE TYPE "DispatchPermitStatus" AS ENUM ('PENDING', 'APPROVED', 'EMAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GovtPermitCategory" AS ENUM ('AIR', 'WATER', 'HAZWASTE', 'BIR', 'PTO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('TANKS', 'VALVE', 'PRESSURE_GAUGE', 'OTHERS');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NORMAL', 'WARNING', 'CRITICAL', 'UNDER_MAINTENANCE');

-- CreateEnum
CREATE TYPE "AutomationModule" AS ENUM ('DISPATCH_PERMIT', 'GOVT_PERMIT_EXPIRY', 'TANK_AND_GAUGE_ALERT', 'MAINTENANCE_DUE');

-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "terminalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchRecord" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "sourcePlant" TEXT NOT NULL,
    "truck" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "orderNumber" TEXT NOT NULL,
    "shipToNumber" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "receivingWindow" TEXT NOT NULL,
    "incident" TEXT,
    "salesRoute" TEXT NOT NULL,
    "permitStatus" "DispatchPermitStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastEmailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentPermit" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "category" "GovtPermitCategory" NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "permitName" TEXT NOT NULL,
    "issuingAgency" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "reminderLeadDays" INTEGER NOT NULL DEFAULT 30,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentPath" TEXT,
    "remarks" TEXT,
    "lastReminderSent" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentPermit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceAsset" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationNote" TEXT,
    "parentAssetId" TEXT,
    "unit" TEXT DEFAULT 'PSI',
    "minThreshold" DOUBLE PRECISION,
    "maxThreshold" DOUBLE PRECISION,
    "latestReading" DOUBLE PRECISION,
    "calibrationDue" TIMESTAMP(3),
    "nextServiceDate" TIMESTAMP(3),
    "condition" "AssetCondition" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "readingValue" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "condition" "AssetCondition" NOT NULL DEFAULT 'NORMAL',
    "findings" TEXT,
    "actionTaken" TEXT,
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRoutingRule" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "module" "AutomationModule" NOT NULL,
    "filterKey" TEXT,
    "toRecipients" TEXT NOT NULL,
    "ccRecipients" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "module" "AutomationModule" NOT NULL,
    "referenceId" TEXT,
    "recipients" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_code_key" ON "Terminal"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DispatchRecord_terminalId_permitStatus_idx" ON "DispatchRecord"("terminalId", "permitStatus");

-- CreateIndex
CREATE INDEX "DispatchRecord_truck_idx" ON "DispatchRecord"("truck");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchRecord_orderNumber_truck_key" ON "DispatchRecord"("orderNumber", "truck");

-- CreateIndex
CREATE INDEX "GovernmentPermit_terminalId_category_idx" ON "GovernmentPermit"("terminalId", "category");

-- CreateIndex
CREATE INDEX "GovernmentPermit_expiryDate_status_idx" ON "GovernmentPermit"("expiryDate", "status");

-- CreateIndex
CREATE INDEX "MaintenanceAsset_terminalId_category_condition_idx" ON "MaintenanceAsset"("terminalId", "category", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAsset_terminalId_assetCode_key" ON "MaintenanceAsset"("terminalId", "assetCode");

-- CreateIndex
CREATE INDEX "MaintenanceLog_assetId_recordedAt_idx" ON "MaintenanceLog"("assetId", "recordedAt");

-- CreateIndex
CREATE INDEX "EmailLog_module_sentAt_idx" ON "EmailLog"("module", "sentAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchRecord" ADD CONSTRAINT "DispatchRecord_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchRecord" ADD CONSTRAINT "DispatchRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentPermit" ADD CONSTRAINT "GovernmentPermit_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentPermit" ADD CONSTRAINT "GovernmentPermit_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAsset" ADD CONSTRAINT "MaintenanceAsset_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAsset" ADD CONSTRAINT "MaintenanceAsset_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "MaintenanceAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MaintenanceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRoutingRule" ADD CONSTRAINT "EmailRoutingRule_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
