import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

const ALLOWED_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "EMAILED"]);
const ALLOWED_PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

const dispatchInclude = {
  terminal: {
    select: { id: true, code: true, name: true },
  },
  approvedBy: {
    select: { id: true, name: true, email: true, role: true },
  },
};

function getPrismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const dispatchId = id?.trim();

    if (!dispatchId) {
      return NextResponse.json(
        { error: "Dispatch ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const existing = await prisma.dispatchRecord.findUnique({
      where: { id: dispatchId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Dispatch record not found." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if (body.sourcePlant !== undefined) {
      data.sourcePlant = String(body.sourcePlant).trim();
    }
    if (body.truck !== undefined) {
      data.truck = String(body.truck).trim().toUpperCase();
    }
    if (body.priority !== undefined) {
      const normalizedPriority = String(body.priority).trim().toUpperCase();
      if (ALLOWED_PRIORITIES.has(normalizedPriority)) {
        data.priority = normalizedPriority;
      }
    }
    if (body.orderNumber !== undefined) {
      data.orderNumber = String(body.orderNumber).trim().toUpperCase();
    }
    if (body.shipToNumber !== undefined) {
      data.shipToNumber = String(body.shipToNumber).trim().toUpperCase();
    }
    if (body.destinationName !== undefined) {
      data.destinationName = String(body.destinationName).trim();
    }
    if (body.receivingWindow !== undefined) {
      data.receivingWindow = String(body.receivingWindow).trim();
    }
    if (body.incident !== undefined) {
      data.incident =
        typeof body.incident === "string" && body.incident.trim()
          ? body.incident.trim()
          : null;
    }
    if (body.salesRoute !== undefined) {
      data.salesRoute = String(body.salesRoute).trim().toUpperCase();
    }
    if (body.terminalId !== undefined && body.terminalId) {
      const nextTerminalId = String(body.terminalId).trim();
      const terminalExists = await prisma.terminal.findUnique({
        where: { id: nextTerminalId },
        select: { id: true },
      });
      if (!terminalExists) {
        return NextResponse.json(
          { error: `Selected terminal (${nextTerminalId}) does not exist.` },
          { status: 400 }
        );
      }
      data.terminalId = nextTerminalId;
    }

    if (body.permitStatus !== undefined) {
      const nextStatus = String(body.permitStatus).trim().toUpperCase();

      if (!ALLOWED_STATUSES.has(nextStatus)) {
        return NextResponse.json(
          {
            error:
              "Invalid status. Allowed values: PENDING, APPROVED, REJECTED, EMAILED.",
          },
          { status: 400 }
        );
      }

      const role = String(session.role || "").toUpperCase();
      if (
        (nextStatus === "APPROVED" || nextStatus === "REJECTED") &&
        role !== "ADMIN" &&
        role !== "APPROVER"
      ) {
        return NextResponse.json(
          {
            error:
              "Only APPROVER or ADMIN accounts can approve/reject permits.",
          },
          { status: 403 }
        );
      }

      data.permitStatus = nextStatus;

      if (nextStatus === "APPROVED") {
        data.approvedById = session.userId;
        data.approvedAt = new Date();
      } else if (nextStatus === "PENDING" || nextStatus === "REJECTED") {
        data.approvedById = null;
        data.approvedAt = null;
      } else if (nextStatus === "EMAILED") {
        data.lastEmailedAt = new Date();
      }
    }

    const dispatch = await prisma.dispatchRecord.update({
      where: { id: dispatchId },
      data,
      include: dispatchInclude,
    });

    return NextResponse.json({ dispatch });
  } catch (error) {
    console.error("Failed to update dispatch:", error);

    const code = getPrismaErrorCode(error);
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Dispatch record not found." },
        { status: 404 }
      );
    }
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A dispatch record with this Order # and Truck already exists." },
        { status: 409 }
      );
    }
    if (code === "P2003") {
      return NextResponse.json(
        { error: "Invalid terminal or approver reference on dispatch record." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update dispatch record." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = String(session.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "APPROVER") {
    return NextResponse.json(
      { error: "Forbidden: Approver or Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const dispatchId = id?.trim();

    if (!dispatchId) {
      return NextResponse.json(
        { error: "Dispatch ID is required." },
        { status: 400 }
      );
    }

    await prisma.dispatchRecord.delete({ where: { id: dispatchId } });
    return NextResponse.json({ success: true, id: dispatchId });
  } catch (error) {
    console.error("Failed to delete dispatch:", error);

    const code = getPrismaErrorCode(error);
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Dispatch record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete dispatch record." },
      { status: 500 }
    );
  }
}