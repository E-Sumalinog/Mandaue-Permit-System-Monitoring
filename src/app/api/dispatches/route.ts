import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { AutomationModule } from "@/generated/prisma/client";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dispatches = await prisma.dispatchRecord.findMany({
    where: session.terminalId ? { terminalId: session.terminalId } : undefined,
    include: {
      terminal: { select: { code: true, name: true } },
      approvedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ dispatches });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const incoming = Array.isArray(body?.records) ? body.records : [];

    if (incoming.length === 0) {
      return NextResponse.json({ error: "No dispatch records provided." }, { status: 400 });
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

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of incoming) {
        const orderNumber = String(item?.orderNumber ?? item?.orderNo ?? "").trim();
        const truck = String(item?.truck ?? item?.truckPlateNo ?? "").trim();
        const destinationName = String(
          item?.destinationName ?? item?.destination ?? ""
        ).trim();

        if (!orderNumber || !truck || !destinationName) {
          continue;
        }

        const sourcePlant = item?.sourcePlant
          ? String(item.sourcePlant).trim()
          : "Mandaue Terminal";
        const shipToNumber = item?.shipToNumber
          ? String(item.shipToNumber).trim()
          : `ST-${orderNumber}`;
        const receivingWindow = item?.receivingWindow
          ? String(item.receivingWindow).trim()
          : "Standard Window";
        const salesRoute = item?.salesRoute
          ? String(item.salesRoute).trim()
          : "Mandaue Route";
        const priority = item?.priority ? String(item.priority).trim() : "NORMAL";
        const incident = item?.incident ? String(item.incident).trim() : null;

        const record = await tx.dispatchRecord.upsert({
          where: {
            orderNumber_truck: {
              orderNumber,
              truck,
            },
          },
          update: {
            terminalId,
            sourcePlant,
            priority,
            shipToNumber,
            destinationName,
            receivingWindow,
            incident,
            salesRoute,
          },
          create: {
            terminalId,
            sourcePlant,
            truck,
            priority,
            orderNumber,
            shipToNumber,
            destinationName,
            receivingWindow,
            incident,
            salesRoute,
            permitStatus: "PENDING",
          },
          include: {
            terminal: { select: { code: true, name: true } },
            approvedBy: { select: { name: true, email: true } },
          },
        });

        results.push(record);
      }
      return results;
    });

    return NextResponse.json({ dispatches: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to import dispatches:", error);
    return NextResponse.json(
      { error: "Failed to import dispatch records." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];
    const action = String(body?.action ?? "");

    if (ids.length === 0) {
      return NextResponse.json({ error: "No dispatch IDs selected." }, { status: 400 });
    }

    if (action === "APPROVE") {
      if (session.role !== "ADMIN" && session.role !== "APPROVER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await prisma.dispatchRecord.updateMany({
        where: { id: { in: ids } },
        data: {
          permitStatus: "APPROVED",
          approvedById: session.userId,
          approvedAt: new Date(),
        },
      });
    } else if (action === "EMAIL") {
      const now = new Date();
      const targets = await prisma.dispatchRecord.findMany({
        where: { id: { in: ids } },
        include: { terminal: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.dispatchRecord.updateMany({
          where: { id: { in: ids } },
          data: {
            permitStatus: "EMAILED",
            lastEmailedAt: now,
          },
        });

        for (const rec of targets) {
          const rule = await tx.emailRoutingRule.findFirst({
            where: {
              terminalId: rec.terminalId,
              module: AutomationModule.DISPATCH_PERMIT,
              isActive: true,
            },
          });

          await tx.emailLog.create({
            data: {
              module: AutomationModule.DISPATCH_PERMIT,
              referenceId: rec.orderNumber,
              recipients:
                rule?.toRecipients ||
                `${(rec.salesRoute || "dispatch").toLowerCase().replace(/\s+/g, ".")}@terminal.local`,
              subject: `[Dispatch Permit] Order #${rec.orderNumber} — Truck ${rec.truck} (${rec.destinationName})`,
              status: "LOGGED",
              errorMessage: null,
            },
          });
        }
      });
    } else {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const updatedDispatches = await prisma.dispatchRecord.findMany({
      where: session.terminalId ? { terminalId: session.terminalId } : undefined,
      include: {
        terminal: { select: { code: true, name: true } },
        approvedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ dispatches: updatedDispatches });
  } catch (error) {
    console.error("Failed to update dispatches:", error);
    return NextResponse.json(
      { error: "Failed to update dispatch records." },
      { status: 500 }
    );
  }
}