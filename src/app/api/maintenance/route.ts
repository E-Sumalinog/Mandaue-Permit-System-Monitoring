import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { AssetCondition, AutomationModule } from "@/generated/prisma/client";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assets = await prisma.maintenanceAsset.findMany({
    where: session.terminalId ? { terminalId: session.terminalId } : undefined,
    include: {
      parentAsset: { select: { id: true, assetCode: true, name: true, category: true } },
      childAssets: { select: { id: true, assetCode: true, name: true, category: true } },
      logs: {
        orderBy: { recordedAt: "desc" },
        take: 5,
        include: {
          recordedBy: { select: { name: true } },
        },
      },
    },
    orderBy: [{ category: "asc" }, { assetCode: "asc" }],
  });

  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const assetId = String(body?.assetId ?? "");
    const readingVal = Number(body?.readingValue ?? body?.psiReading);
    const findings = String(body?.findings ?? body?.remarks ?? "").trim();
    const sendAlertOnly = Boolean(body?.sendAlertOnly);

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID is required." }, { status: 400 });
    }

    const asset = await prisma.maintenanceAsset.findUnique({
      where: { id: assetId },
      include: {
        terminal: true,
        parentAsset: { select: { id: true, assetCode: true, name: true, category: true } },
        childAssets: { select: { id: true, assetCode: true, name: true, category: true } },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Maintenance asset not found." }, { status: 404 });
    }

    if (sendAlertOnly) {
      const rule = await prisma.emailRoutingRule.findFirst({
        where: {
          terminalId: asset.terminalId,
          module: AutomationModule.TANK_AND_GAUGE_ALERT,
          isActive: true,
        },
      });

      await prisma.emailLog.create({
        data: {
          module: AutomationModule.TANK_AND_GAUGE_ALERT,
          referenceId: asset.assetCode,
          recipients: rule?.toRecipients || "maintenance.mandaue@company.local",
          subject: `[${asset.terminal.name}] ${asset.condition} Alert - ${asset.assetCode} (${asset.name})`,
          status: "LOGGED",
          errorMessage: null,
        },
      });

      return NextResponse.json({ ok: true, alertSent: true });
    }

    if (Number.isNaN(readingVal)) {
      return NextResponse.json({ error: "Valid reading value is required." }, { status: 400 });
    }

    const min = asset.minThreshold ?? 0;
    const max = asset.maxThreshold ?? 100;
    let nextCondition: AssetCondition = AssetCondition.NORMAL;
    let breached = false;

    if (readingVal > max || readingVal < min) {
      nextCondition = AssetCondition.CRITICAL;
      breached = true;
    } else if (readingVal >= max - 4 || readingVal <= min + 4) {
      nextCondition = AssetCondition.WARNING;
    }

    const latestLog = await prisma.maintenanceLog.findFirst({
      where: { assetId: asset.id },
      orderBy: { recordedAt: "desc" },
      select: { temperatureC: true },
    });

    const updatedAsset = await prisma.$transaction(async (tx) => {
      await tx.maintenanceLog.create({
        data: {
          assetId: asset.id,
          readingValue: readingVal,
          temperatureC: latestLog?.temperatureC ?? null,
          condition: nextCondition,
          findings: findings || "Logged via terminal monitoring.",
          alertTriggered: breached,
          recordedById: session.userId,
        },
      });

      if (breached) {
        const rule = await tx.emailRoutingRule.findFirst({
          where: {
            terminalId: asset.terminalId,
            module: AutomationModule.TANK_AND_GAUGE_ALERT,
            isActive: true,
          },
        });

        await tx.emailLog.create({
          data: {
            module: AutomationModule.TANK_AND_GAUGE_ALERT,
            referenceId: asset.assetCode,
            recipients: rule?.toRecipients || "safety.mandaue@company.local",
            subject: `[CRITICAL ${asset.unit || "PSI"}] ${asset.assetCode} (${asset.name}) read ${readingVal.toFixed(1)} ${asset.unit || "PSI"}`,
            status: "LOGGED",
            errorMessage: null,
          },
        });
      }

      return tx.maintenanceAsset.update({
        where: { id: asset.id },
        data: {
          latestReading: readingVal,
          condition: nextCondition,
          updatedAt: new Date(),
        },
        include: {
          parentAsset: { select: { id: true, assetCode: true, name: true, category: true } },
          childAssets: { select: { id: true, assetCode: true, name: true, category: true } },
          logs: {
            orderBy: { recordedAt: "desc" },
            take: 5,
            include: {
              recordedBy: { select: { name: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({
      asset: updatedAsset,
      breached,
    });
  } catch (error) {
    console.error("Failed to save maintenance log:", error);
    return NextResponse.json(
      { error: "Failed to save inspection reading." },
      { status: 500 }
    );
  }
}