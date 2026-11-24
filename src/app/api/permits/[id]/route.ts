import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { ComplianceStatus, GovtPermitCategory } from "@/generated/prisma/client";

const VALID_CATEGORIES = new Set<string>([
  "AIR",
  "WATER",
  "HAZWASTE",
  "BIR",
  "PTO",
  "BUSINESS",
]);

function computeComplianceStatus(expiryDate: Date, reminderLeadDays: number): ComplianceStatus {
  const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return ComplianceStatus.EXPIRED;
  if (diffDays <= reminderLeadDays) return ComplianceStatus.EXPIRING_SOON;
  return ComplianceStatus.ACTIVE;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permits = await prisma.governmentPermit.findMany({
    where: session.terminalId ? { terminalId: session.terminalId } : undefined,
    include: {
      terminal: { select: { code: true, name: true } },
      updatedBy: { select: { name: true, email: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  return NextResponse.json({ permits });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const categoryRaw = String(body?.category ?? "").toUpperCase();
    const permitNumber = String(body?.permitNumber ?? "").trim();
    const permitName = String(body?.permitName ?? "").trim();
    const issuingAgency = String(body?.issuingAgency ?? "").trim() || "Government Agency";
    const expiryDateRaw = String(body?.expiryDate ?? "");
    const reminderLeadDays = Number(body?.reminderLeadDays ?? 30) || 30;

    if (!VALID_CATEGORIES.has(categoryRaw) || !permitNumber || !permitName || !expiryDateRaw) {
      return NextResponse.json(
        { error: "Category, permit number, permit name, and expiry date are required." },
        { status: 400 }
      );
    }

    const expiryDate = new Date(expiryDateRaw);
    if (Number.isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
    }

    let terminalId = session.terminalId;
    if (!terminalId) {
      const defaultTerminal = await prisma.terminal.findUnique({
        where: { code: "MANDAUE-01" },
        select: { id: true },
      });
      terminalId = defaultTerminal?.id ?? null;
    }

    if (!terminalId) {
      return NextResponse.json({ error: "No terminal assigned." }, { status: 400 });
    }

    const status = computeComplianceStatus(expiryDate, reminderLeadDays);

    const created = await prisma.governmentPermit.create({
      data: {
        terminalId,
        category: categoryRaw as GovtPermitCategory,
        permitNumber,
        permitName,
        issuingAgency,
        issueDate: new Date(),
        expiryDate,
        reminderLeadDays,
        status,
        updatedById: session.userId,
      },
      include: {
        terminal: { select: { code: true, name: true } },
        updatedBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ permit: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating permit:", error);
    return NextResponse.json({ error: "Failed to create government permit." }, { status: 500 });
  }
}