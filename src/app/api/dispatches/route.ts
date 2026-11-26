import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

const ALLOWED_PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const terminalId = searchParams.get("terminalId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (terminalId && terminalId !== "ALL") {
      where.terminalId = terminalId;
    }
    if (status && status !== "ALL") {
      where.permitStatus = status;
    }

    const dispatches = await prisma.dispatchRecord.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({ dispatches });
  } catch (error) {
    console.error("Failed to fetch dispatches:", error);
    return NextResponse.json(
      { error: "Failed to load dispatch records from Neon." },
      { status: 500 }
    );
  }
}

function getPrismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    let terminalId =
      typeof body.terminalId === "string" && body.terminalId.trim()
        ? body.terminalId.trim()
        : null;

    if (!terminalId) {
      const defaultTerminal = await prisma.terminal.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      terminalId = defaultTerminal?.id ?? null;
    }

    if (!terminalId) {
      return NextResponse.json(
        { error: "No active terminal found. Please create a terminal first." },
        { status: 400 }
      );
    }

    const terminalExists = await prisma.terminal.findUnique({
      where: { id: terminalId },
      select: { id: true },
    });

    if (!terminalExists) {
      return NextResponse.json(
        { error: `Selected terminal (${terminalId}) does not exist.` },
        { status: 400 }
      );
    }

    const sourcePlant = String(body.sourcePlant || "").trim();
    const truck = String(body.truck || "").trim().toUpperCase();
    const rawPriority = String(body.priority || "NORMAL").trim().toUpperCase();
    const priority = ALLOWED_PRIORITIES.has(rawPriority) ? rawPriority : "NORMAL";
    const orderNumber = String(body.orderNumber || "").trim().toUpperCase();
    const shipToNumber = String(body.shipToNumber || "").trim().toUpperCase();
    const destinationName = String(body.destinationName || "").trim();
    const receivingWindow = String(body.receivingWindow || "").trim();
    const incident =
      typeof body.incident === "string" && body.incident.trim()
        ? body.incident.trim()
        : null;
    const salesRoute = String(body.salesRoute || "").trim().toUpperCase();

    if (
      !sourcePlant ||
      !truck ||
      !orderNumber ||
      !shipToNumber ||
      !destinationName ||
      !receivingWindow ||
      !salesRoute
    ) {
      return NextResponse.json(
        { error: "All required trip and destination fields must be filled out." },
        { status: 400 }
      );
    }

    const dispatch = await prisma.dispatchRecord.create({
      data: {
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
    });

    return NextResponse.json({ dispatch }, { status: 201 });
  } catch (error) {
    console.error("Failed to create dispatch:", error);

    const code = getPrismaErrorCode(error);
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A dispatch record with this Order # and Truck already exists." },
        { status: 409 }
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        { error: "Invalid terminal or user reference on dispatch record." },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to create dispatch record.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}