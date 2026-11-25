import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { ComplianceStatus, GovtPermitCategory } from "@/generated/prisma/client";

function computeComplianceStatus(
  expiryDate: Date,
  reminderLeadDays: number
): ComplianceStatus {
  const now = new Date();
  if (expiryDate.getTime() < now.getTime()) {
    return ComplianceStatus.EXPIRED;
  }
  const thresholdMs = reminderLeadDays * 24 * 60 * 60 * 1000;
  if (expiryDate.getTime() - now.getTime() <= thresholdMs) {
    return ComplianceStatus.EXPIRING_SOON;
  }
  return ComplianceStatus.ACTIVE;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [permits, routingRules, emailLogs] = await Promise.all([
      prisma.governmentPermit.findMany({
        orderBy: { expiryDate: "asc" },
        include: {
          terminal: { select: { id: true, code: true, name: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.emailRoutingRule.findMany({
        where: { module: "GOVT_PERMIT_EXPIRY", isActive: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.emailLog.findMany({
        where: { module: "GOVT_PERMIT_EXPIRY" },
        orderBy: { sentAt: "desc" },
        take: 25,
      }),
    ]);

    return NextResponse.json({ permits, routingRules, emailLogs });
  } catch (error) {
    console.error("GET /api/permits error:", error);
    return NextResponse.json(
      { error: "Failed to load government permits." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const category = String(body.category || "").toUpperCase() as GovtPermitCategory;
    const permitNumber = String(body.permitNumber || "").trim().toUpperCase();
    const permitName = String(body.permitName || "").trim();
    const issuingAgency = body.issuingAgency ? String(body.issuingAgency).trim() : null;
    const issueDate = new Date(body.issueDate);
    const expiryDate = new Date(body.expiryDate);
    const reminderLeadDays = Number.isFinite(Number(body.reminderLeadDays))
      ? Math.max(1, Number(body.reminderLeadDays))
      : 30;
    const documentPath = body.documentPath ? String(body.documentPath).trim() : null;
    const remarks = body.remarks ? String(body.remarks).trim() : null;
    const recipientEmail = body.recipientEmail ? String(body.recipientEmail).trim() : "";

    if (!Object.values(GovtPermitCategory).includes(category)) {
      return NextResponse.json({ error: "Invalid permit category." }, { status: 400 });
    }
    if (!permitNumber || !permitName || Number.isNaN(issueDate.getTime()) || Number.isNaN(expiryDate.getTime())) {
      return NextResponse.json(
        { error: "Permit number, name, issue date, and expiry date are required." },
        { status: 400 }
      );
    }

    let terminalId = body.terminalId ? String(body.terminalId).trim() : "";
    if (!terminalId) {
      const defaultTerminal = await prisma.terminal.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!defaultTerminal) {
        return NextResponse.json({ error: "No active terminal found." }, { status: 400 });
      }
      terminalId = defaultTerminal.id;
    }

    const status = computeComplianceStatus(expiryDate, reminderLeadDays);

    const permit = await prisma.governmentPermit.create({
      data: {
        terminalId,
        category,
        permitNumber,
        permitName,
        issuingAgency,
        issueDate,
        expiryDate,
        reminderLeadDays,
        status,
        documentPath,
        remarks,
        updatedById: session.userId ?? null,
      },
      include: {
        terminal: { select: { id: true, code: true, name: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (recipientEmail) {
      await prisma.emailRoutingRule.create({
        data: {
          terminalId,
          module: "GOVT_PERMIT_EXPIRY",
          filterKey: permit.id,
          toRecipients: recipientEmail,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true, permit }, { status: 201 });
  } catch (error) {
    console.error("POST /api/permits error:", error);
    return NextResponse.json(
      { error: "Failed to create government permit." },
      { status: 500 }
    );
  }
}