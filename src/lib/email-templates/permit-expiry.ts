export interface PermitExpiryEmailInput {
  permitName: string;
  permitNumber: string;
  category: string;
  issuingAgency: string | null;
  terminalName: string;
  issueDate: Date;
  expiryDate: Date;
  daysUntilExpiry: number;
  reminderLeadDays: number;
  remarks: string | null;
  portalUrl?: string;
}

export interface RenderedPermitEmail {
  subject: string;
  html: string;
  text: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  AIR: "Air Emissions / DENR-EMB Permit",
  WATER: "Wastewater Discharge Permit",
  HAZWASTE: "Hazardous Waste Generator / TSD Compliance",
  BIR: "BIR Tax & Books Registration",
  PTO: "DOLE Permit to Operate (Mechanical / Electrical)",
  BUSINESS: "LGU Mayor's / Business Permit",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export function renderPermitExpiryEmail(
  input: PermitExpiryEmailInput
): RenderedPermitEmail {
  const isExpired = input.daysUntilExpiry < 0;
  const absDays = Math.abs(input.daysUntilExpiry);

  const statusLabel = isExpired ? "EXPIRED — IMMEDIATE ACTION" : "EXPIRING SOON";
  const accentColor = isExpired ? "#dc2626" : "#d97706";
  const badgeBg = isExpired ? "#fef2f2" : "#fffbeb";
  const badgeBorder = isExpired ? "#fecaca" : "#fde68a";

  const countdownText = isExpired
    ? `Overdue by ${absDays} day${absDays === 1 ? "" : "s"}`
    : input.daysUntilExpiry === 0
      ? "Expires today"
      : `${input.daysUntilExpiry} day${input.daysUntilExpiry === 1 ? "" : "s"} remaining`;

  const categoryDescription =
    CATEGORY_LABELS[input.category.toUpperCase()] ?? input.category;

  const defaultActionMessage = isExpired
    ? `This ${categoryDescription} passed its validity date on ${formatDate(input.expiryDate)}. Immediate renewal filing and compliance verification are required to avoid regulatory penalties or terminal operational disruption.`
    : `This ${categoryDescription} is within its ${input.reminderLeadDays}-day pre-expiry window and will expire on ${formatDate(input.expiryDate)}. Please prepare renewal requirements and submit documentation ahead of the deadline.`;

  const customRemarks = input.remarks?.trim() || null;
  const agencyDisplay = input.issuingAgency?.trim() || "Not specified";
  const portalLink =
    input.portalUrl ||
    `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/permits`;

  const subject = isExpired
    ? `[OVERDUE PERMIT] ${input.category} - ${input.permitName} (${input.permitNumber})`
    : `[Permit Expiry Alert] ${input.category} - ${input.permitName} (${input.permitNumber}) • ${countdownText}`;

  const text = [
    `${statusLabel}: ${input.permitName}`,
    "==================================================",
    defaultActionMessage,
    "",
    ...(customRemarks ? [`Action Notes / Instructions: ${customRemarks}`, ""] : []),
    `Terminal: ${input.terminalName}`,
    `Category: ${input.category} (${categoryDescription})`,
    `Permit Number: ${input.permitNumber}`,
    `Issuing Agency: ${agencyDisplay}`,
    `Issue Date: ${formatDate(input.issueDate)}`,
    `Expiry Date: ${formatDate(input.expiryDate)} (${countdownText})`,
    `Reminder Lead Window: ${input.reminderLeadDays} day(s)`,
    "",
    `View in Portal: ${portalLink}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <!-- Top Header -->
          <tr>
            <td style="background-color:#0f172a;padding:20px 24px;">
              <p style="margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;font-weight:600;">
                Ops &amp; Permit Hub • Compliance Automation
              </p>
              <h1 style="margin:6px 0 0;font-size:19px;line-height:1.3;color:#ffffff;font-weight:700;">
                Government Permit Expiry Notification
              </h1>
            </td>
          </tr>

          <!-- Status Banner -->
          <tr>
            <td style="padding:20px 24px 0;">
              <div style="background-color:${badgeBg};border:1px solid ${badgeBorder};border-left:4px solid ${accentColor};border-radius:8px;padding:14px 16px;">
                <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:0.6px;color:${accentColor};text-transform:uppercase;">
                  ${escapeHtml(statusLabel)} • ${escapeHtml(countdownText)}
                </span>
                <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#1e293b;">
                  ${escapeHtml(defaultActionMessage)}
                </p>
              </div>
            </td>
          </tr>

          ${
            customRemarks
              ? `
          <!-- Per-Permit Custom Remarks -->
          <tr>
            <td style="padding:16px 24px 0;">
              <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;">
                <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1d4ed8;">
                  Permit Instructions / Remarks
                </p>
                <p style="margin:4px 0 0;font-size:13.5px;line-height:1.5;color:#1e3a8a;">
                  ${escapeHtml(customRemarks)}
                </p>
              </div>
            </td>
          </tr>`
              : ""
          }

          <!-- Permit Details Table -->
          <tr>
            <td style="padding:20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13.5px;">
                <tr style="background-color:#f8fafc;">
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;width:38%;font-weight:600;">Permit Name</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;">${escapeHtml(input.permitName)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;">Permit Number</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input.permitNumber)}</td>
                </tr>
                <tr style="background-color:#f8fafc;">
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;">Category</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(input.category)} — ${escapeHtml(categoryDescription)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;">Terminal</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(input.terminalName)}</td>
                </tr>
                <tr style="background-color:#f8fafc;">
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;">Issuing Agency</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(agencyDisplay)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;">Issue Date</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(formatDate(input.issueDate))}</td>
                </tr>
                <tr style="background-color:#f8fafc;">
                  <td style="padding:10px 14px;color:#64748b;font-weight:600;">Expiry Date</td>
                  <td style="padding:10px 14px;color:${accentColor};font-weight:700;">${escapeHtml(formatDate(input.expiryDate))} (${escapeHtml(countdownText)})</td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="margin-top:22px;text-align:center;">
                <a href="${escapeHtml(portalLink)}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:600;padding:11px 22px;border-radius:8px;">
                  Open Government Permits Portal
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 24px;text-align:center;">
              <p style="margin:0;font-size:11.5px;color:#64748b;line-height:1.4;">
                Automated compliance reminder triggered ${input.reminderLeadDays} day(s) prior to expiration.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}