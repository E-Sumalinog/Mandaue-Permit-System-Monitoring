import { config } from "dotenv";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  UserRole,
  DispatchPermitStatus,
  GovtPermitCategory,
  ComplianceStatus,
  MaintenanceCategory,
  AssetCondition,
  AutomationModule,
} from "../src/generated/prisma/client";

config({ path: ".env.local" });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Terminal
    const terminal = await prisma.terminal.upsert({
      where: { code: "MANDAUE-01" },
      update: {
        name: "Mandaue Terminal",
        location: "Mandaue City, Cebu",
        isActive: true,
      },
      create: {
        code: "MANDAUE-01",
        name: "Mandaue Terminal",
        location: "Mandaue City, Cebu",
        isActive: true,
      },
    });

    // 2. Users (Admin, Approver, Staff)
    const adminUser = await prisma.user.upsert({
      where: { email: "admin.mandaue@terminal.local" },
      update: {},
      create: {
        name: "Terminal Admin",
        email: "admin.mandaue@terminal.local",
        passwordHash: hashPassword("Admin@1234"),
        role: UserRole.ADMIN,
        isActive: true,
        terminalId: terminal.id,
      },
    });

    const approverUser = await prisma.user.upsert({
      where: { email: "approver.mandaue@terminal.local" },
      update: {},
      create: {
        name: "Operations Approver",
        email: "approver.mandaue@terminal.local",
        passwordHash: hashPassword("Approver@1234"),
        role: UserRole.APPROVER,
        isActive: true,
        terminalId: terminal.id,
      },
    });

    const staffUser = await prisma.user.upsert({
      where: { email: "staff.mandaue@terminal.local" },
      update: {},
      create: {
        name: "Terminal Staff",
        email: "staff.mandaue@terminal.local",
        passwordHash: hashPassword("Staff@1234"),
        role: UserRole.STAFF,
        isActive: true,
        terminalId: terminal.id,
      },
    });

    // 3. Dispatcher Center / Trip Records
    const dispatches = [
      {
        sourcePlant: "Mandaue Depot",
        truck: "TRK-101",
        priority: "HIGH",
        orderNumber: "SO-2026-001",
        shipToNumber: "SHP-8801",
        destinationName: "Cebu South Distribution Hub",
        receivingWindow: "08:00 - 11:00",
        incident: null,
        salesRoute: "CEB-SOUTH-01",
        permitStatus: DispatchPermitStatus.APPROVED,
        approvedById: approverUser.id,
        approvedAt: new Date("2026-11-24T06:00:00Z"),
        lastEmailedAt: new Date("2026-11-24T06:05:00Z"),
      },
      {
        sourcePlant: "Mandaue Depot",
        truck: "TRK-104",
        priority: "NORMAL",
        orderNumber: "SO-2026-002",
        shipToNumber: "SHP-8814",
        destinationName: "Lapu-Lapu Industrial Park",
        receivingWindow: "13:00 - 16:00",
        incident: "Gate pass verification pending",
        salesRoute: "CEB-LLC-02",
        permitStatus: DispatchPermitStatus.PENDING,
        approvedById: null,
        approvedAt: null,
        lastEmailedAt: null,
      },
    ];

    for (const item of dispatches) {
      await prisma.dispatchRecord.upsert({
        where: {
          orderNumber_truck: {
            orderNumber: item.orderNumber,
            truck: item.truck,
          },
        },
        update: item,
        create: {
          terminalId: terminal.id,
          ...item,
        },
      });
    }

    // 4. Government Permits (AIR, WATER, HAZWASTE, BIR, PTO, BUSINESS)
    const existingPermits = await prisma.governmentPermit.count({
      where: { terminalId: terminal.id },
    });

    if (existingPermits === 0) {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      await prisma.governmentPermit.createMany({
        data: [
          {
            terminalId: terminal.id,
            category: GovtPermitCategory.AIR,
            permitNumber: "DENR-AIR-2026-01",
            permitName: "Permit to Operate (Air Emissions)",
            issuingAgency: "DENR-EMB Region VII",
            issueDate: new Date(now - 240 * dayMs),
            expiryDate: new Date(now + 125 * dayMs),
            reminderLeadDays: 30,
            status: ComplianceStatus.ACTIVE,
            remarks: "Stack testing compliant",
            updatedById: adminUser.id,
          },
          {
            terminalId: terminal.id,
            category: GovtPermitCategory.WATER,
            permitNumber: "DENR-WTR-2026-02",
            permitName: "Discharge Permit (Wastewater)",
            issuingAgency: "DENR-EMB Region VII",
            issueDate: new Date(now - 340 * dayMs),
            expiryDate: new Date(now + 25 * dayMs),
            reminderLeadDays: 30,
            status: ComplianceStatus.EXPIRING_SOON,
            remarks: "Renewal packet under review",
            updatedById: adminUser.id,
          },
          {
            terminalId: terminal.id,
            category: GovtPermitCategory.HAZWASTE,
            permitNumber: "DENR-HW-2026-03",
            permitName: "Hazardous Waste Generator ID",
            issuingAgency: "DENR-EMB",
            issueDate: new Date(now - 180 * dayMs),
            expiryDate: new Date(now + 185 * dayMs),
            reminderLeadDays: 30,
            status: ComplianceStatus.ACTIVE,
            remarks: "Registered treater manifests up to date",
            updatedById: adminUser.id,
          },
          {
            terminalId: terminal.id,
            category: GovtPermitCategory.BIR,
            permitNumber: "BIR-COR-2026-04",
            permitName: "Certificate of Registration & Authority to Print",
            issuingAgency: "Bureau of Internal Revenue",
            issueDate: new Date(now - 200 * dayMs),
            expiryDate: new Date(now + 165 * dayMs),
            reminderLeadDays: 30,
            status: ComplianceStatus.ACTIVE,
            remarks: "Annual registration verified",
            updatedById: adminUser.id,
          },
          {
            terminalId: terminal.id,
            category: GovtPermitCategory.PTO,
            permitNumber: "DOLE-PTO-2026-05",
            permitName: "Permit to Operate Mechanical Equipment",
            issuingAgency: "DOLE / Local Engineering",
            issueDate: new Date(now - 350 * dayMs),
            expiryDate: new Date(now + 15 * dayMs),
            reminderLeadDays: 30,
            status: ComplianceStatus.EXPIRING_SOON,
            remarks: "Inspection schedule confirmed",
            updatedById: adminUser.id,
          },
          {
            terminalId: terminal.id,
            category: GovtPermitCategory.BUSINESS,
            permitNumber: "MANDAUE-BP-2026-06",
            permitName: "Mandaue City Mayor's / Business Permit",
            issuingAgency: "LGU Mandaue City",
            issueDate: new Date(now - 330 * dayMs),
            expiryDate: new Date(now + 35 * dayMs),
            reminderLeadDays: 45,
            status: ComplianceStatus.ACTIVE,
            remarks: "Q4 business tax clearance ready",
            updatedById: adminUser.id,
          },
        ],
      });
    }

    // 5. Maintenance Assets (TANKS, VALVE -> PRESSURE_GAUGE, OTHERS)
    const tankAsset = await prisma.maintenanceAsset.upsert({
      where: {
        terminalId_assetCode: {
          terminalId: terminal.id,
          assetCode: "TNK-01",
        },
      },
      update: {
        latestReading: 18.5,
        condition: AssetCondition.NORMAL,
      },
      create: {
        terminalId: terminal.id,
        category: MaintenanceCategory.TANKS,
        assetCode: "TNK-01",
        name: "Storage Tank 01",
        locationNote: "Tank Farm North",
        unit: "PSI",
        minThreshold: 5,
        maxThreshold: 35,
        latestReading: 18.5,
        calibrationDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        nextServiceDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        condition: AssetCondition.NORMAL,
      },
    });

    const valveAsset = await prisma.maintenanceAsset.upsert({
      where: {
        terminalId_assetCode: {
          terminalId: terminal.id,
          assetCode: "VLV-12",
        },
      },
      update: {
        latestReading: 42.0,
        condition: AssetCondition.NORMAL,
      },
      create: {
        terminalId: terminal.id,
        category: MaintenanceCategory.VALVE,
        assetCode: "VLV-12",
        name: "Main Line Isolation Valve 12",
        locationNote: "Manifold A",
        unit: "PSI",
        minThreshold: 10,
        maxThreshold: 80,
        latestReading: 42.0,
        calibrationDue: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
        nextServiceDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        condition: AssetCondition.NORMAL,
      },
    });

    const gaugeAsset = await prisma.maintenanceAsset.upsert({
      where: {
        terminalId_assetCode: {
          terminalId: terminal.id,
          assetCode: "PG-12A",
        },
      },
      update: {
        parentAssetId: valveAsset.id,
        latestReading: 41.5,
        condition: AssetCondition.NORMAL,
      },
      create: {
        terminalId: terminal.id,
        category: MaintenanceCategory.PRESSURE_GAUGE,
        assetCode: "PG-12A",
        name: "Pressure Gauge 12A (on Valve 12)",
        locationNote: "Manifold A - Downstream",
        parentAssetId: valveAsset.id,
        unit: "PSI",
        minThreshold: 10,
        maxThreshold: 75,
        latestReading: 41.5,
        calibrationDue: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        nextServiceDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        condition: AssetCondition.NORMAL,
      },
    });

    const otherAsset = await prisma.maintenanceAsset.upsert({
      where: {
        terminalId_assetCode: {
          terminalId: terminal.id,
          assetCode: "OTH-01",
        },
      },
      update: {
        latestReading: 60.0,
        condition: AssetCondition.NORMAL,
      },
      create: {
        terminalId: terminal.id,
        category: MaintenanceCategory.OTHERS,
        assetCode: "OTH-01",
        name: "Loading Rack Fire & Safety Pump",
        locationNote: "Loading Bay 1-4",
        unit: "PSI",
        minThreshold: 30,
        maxThreshold: 110,
        latestReading: 60.0,
        calibrationDue: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        nextServiceDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
        condition: AssetCondition.NORMAL,
      },
    });

    // 6. Maintenance Log (seed one initial log if none exist)
    const existingLogs = await prisma.maintenanceLog.count();
    if (existingLogs === 0) {
      await prisma.maintenanceLog.createMany({
        data: [
          {
            assetId: tankAsset.id,
            readingValue: 18.5,
            temperatureC: 29.4,
            condition: AssetCondition.NORMAL,
            findings: "No leaks or abnormal pressure",
            actionTaken: "Routine visual inspection completed",
            alertTriggered: false,
            recordedById: staffUser.id,
          },
          {
            assetId: gaugeAsset.id,
            readingValue: 41.5,
            temperatureC: 30.1,
            condition: AssetCondition.NORMAL,
            findings: "Gauge needle steady within operating band",
            actionTaken: "Verified against valve pressure",
            alertTriggered: false,
            recordedById: staffUser.id,
          },
          {
            assetId: otherAsset.id,
            readingValue: 60.0,
            temperatureC: 28.8,
            condition: AssetCondition.NORMAL,
            findings: "Standby pressure nominal",
            actionTaken: "Logged daily shift reading",
            alertTriggered: false,
            recordedById: staffUser.id,
          },
        ],
      });
    }

    // 7. Email Routing Rules & Sample Email Log
    const existingRules = await prisma.emailRoutingRule.count({
      where: { terminalId: terminal.id },
    });

    if (existingRules === 0) {
      await prisma.emailRoutingRule.createMany({
        data: [
          {
            terminalId: terminal.id,
            module: AutomationModule.DISPATCH_PERMIT,
            filterKey: "APPROVED",
            toRecipients: "dispatch.mandaue@company.local",
            ccRecipients: "ops.lead@company.local",
            isActive: true,
          },
          {
            terminalId: terminal.id,
            module: AutomationModule.GOVT_PERMIT_EXPIRY,
            filterKey: "30_DAYS",
            toRecipients: "compliance.mandaue@company.local",
            ccRecipients: "admin.mandaue@terminal.local",
            isActive: true,
          },
          {
            terminalId: terminal.id,
            module: AutomationModule.TANK_AND_GAUGE_ALERT,
            filterKey: "CRITICAL",
            toRecipients: "maintenance.mandaue@company.local",
            ccRecipients: "safety.mandaue@company.local",
            isActive: true,
          },
        ],
      });
    }

    const existingEmailLogs = await prisma.emailLog.count();
    if (existingEmailLogs === 0) {
      await prisma.emailLog.create({
        data: {
          module: AutomationModule.DISPATCH_PERMIT,
          referenceId: "SO-2026-001",
          recipients: "dispatch.mandaue@company.local",
          subject: "[Mandaue Terminal] Dispatch Permit Approved - TRK-101 (SO-2026-001)",
          status: "SEEDED_PREVIEW",
          errorMessage: null,
        },
      });
    }

    console.log("Seed completed successfully for Mandaue Terminal.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});