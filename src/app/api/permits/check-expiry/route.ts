import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { ComplianceStatus, AutomationModule } from "@/generated/prisma/client";
import { renderPermitExpiryEmail } from "@/lib/email-templates/permit-expiry";

function createGmailTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function resolveRecipients(
  permitId: string,
  category: string,
  terminalId: string,
  rules: Array<{
    terminalId: string;
    filterKey: string | null;
    toRecipients: string;
    ccRecipients: string | null;
  }>
): string[] {
  const matched = rules.filter((r) => {
    if (r.terminalId !== terminalId) return false;
    if (!r.filterKey) return true;
    const key = r.filterKey.trim().toUpperCase();
    return key === permitId.toUpperCase() || key === category.toUpperCase();
  });

  // Prefer permit-specific rule (filterKey === permitId) over category/general rules
  const specific = matched.filter(
    (r) => (r.filterKey || "").trim().toUpperCase() === permitId.toUpperCase()
  );
  const chosen = specific.length > 0 ? specific : matched;

  const list = chosen.flatMap((r) =>
    [r.toRecipients, r.ccRecipients]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  return Array.from(new Set(list));
}

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const transporter = createGmailTransporter();

    const [permits, rules] = await Promise.all([
      prisma.governmentPermit.findMany({
        include: { terminal: { select: { name: true } } },
      }),
      prisma.emailRoutingRule.findMany({
        where: { module: AutomationModule.GOVT_PERMIT_EXPIRY, isActive: true },
      }),
    ]);

    let notifiedCount = 0;
    let failedCount = 0;

    for (const permit of permits) {
      const msUntilExpiry = permit.expiryDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));
      const nextStatus =
        msUntilExpiry < 0
          ? ComplianceStatus.EXPIRED
          : daysUntilExpiry <= permit.reminderLeadDays
            ? ComplianceStatus.EXPIRING_SOON
            : ComplianceStatus.ACTIVE;

      if (nextStatus !== permit.status) {
        await prisma.governmentPermit.update({
          where: { id: permit.id },
          data: { status: nextStatus },
        });
      }

      const isWithinLeadWindow = daysUntilExpiry <= permit.reminderLeadDays;
      const alreadySentRecently =
        permit.lastReminderSent &&
        now.getTime() - permit.lastReminderSent.getTime() < 24 * 60 * 60 * 1000;

      if (!isWithinLeadWindow || alreadySentRecently) {
        continue;
      }

      const rendered = renderPermitExpiryEmail({
        permitName: permit.permitName,
        permitNumber: permit.permitNumber,
        category: permit.category,
        issuingAgency: permit.issuingAgency,
        terminalName: permit.terminal?.name ?? permit.terminalId,
        issueDate: permit.issueDate,
        expiryDate: permit.expiryDate,
        daysUntilExpiry,
        reminderLeadDays: permit.reminderLeadDays,
        remarks: permit.remarks,
      });

      const recipients = resolveRecipients(
        permit.id,
        permit.category,
        permit.terminalId,
        rules
      );

      if (recipients.length === 0) {
        await prisma.emailLog.create({
          data: {
            module: AutomationModule.GOVT_PERMIT_EXPIRY,
            referenceId: permit.id,
            recipients: "UNCONFIGURED",
            subject: rendered.subject,
            status: "SKIPPED",
            errorMessage: "No active recipient email rule found for this permit.",
          },
        });
        continue;
      }

      if (!transporter) {
        failedCount++;
        await prisma.emailLog.create({
          data: {
            module: AutomationModule.GOVT_PERMIT_EXPIRY,
            referenceId: permit.id,
            recipients: recipients.join(", "),
            subject: rendered.subject,
            status: "FAILED",
            errorMessage: "GMAIL_USER or GMAIL_APP_PASSWORD is missing in .env.local.",
          },
        });
        continue;
      }

      try {
        await transporter.sendMail({
          from: `"Ops & Permit Hub" <${process.env.GMAIL_USER}>`,
          to: recipients.join(", "),
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });

        await prisma.emailLog.create({
          data: {
            module: AutomationModule.GOVT_PERMIT_EXPIRY,
            referenceId: permit.id,
            recipients: recipients.join(", "),
            subject: rendered.subject,
            status: "SENT",
            errorMessage: null,
          },
        });

        await prisma.governmentPermit.update({
          where: { id: permit.id },
          data: {
            status: nextStatus,
            lastReminderSent: now,
          },
        });

        notifiedCount++;
      } catch (mailError) {
        failedCount++;
        const errMsg =
          mailError instanceof Error
            ? mailError.message
            : "Failed to send email via Gmail SMTP.";

        await prisma.emailLog.create({
          data: {
            module: AutomationModule.GOVT_PERMIT_EXPIRY,
            referenceId: permit.id,
            recipients: recipients.join(", "),
            subject: rendered.subject,
            status: "FAILED",
            errorMessage: errMsg,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      notifiedCount,
      failedCount,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("POST /api/permits/check-expiry error:", error);
    return NextResponse.json(
      { error: "Failed to run permit expiry check." },
      { status: 500 }
    );
  }
}