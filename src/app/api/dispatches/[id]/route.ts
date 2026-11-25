import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

const dispatchInclude = {
  terminal: {
    select: { id: true, code: true, name: true },
  },
  approvedBy: {
    select: { id: true, name: true, email: true, role: true },
  },
};

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
    const body = await req.json();

    const existing = await prisma.dispatchRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Dispatch record not found." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if (body.sourcePlant !== undefined)
      data.sourcePlant = String(body.sourcePlant).trim();
    if (body.truck !== undefined)
      data.truck = String(body.truck).trim().toUpperCase();
    if (body.priority !== undefined)
      data.priority = String(body.priority).trim().toUpperCase();
    if (body.orderNumber !== undefined)
      data.orderNumber = String(body.orderNumber).trim().toUpperCase();
    if (body.shipToNumber !== undefined)
      data.shipToNumber = String(body.shipToNumber).trim().toUpperCase();
    if (body.destinationName !== undefined)
      data.destinationName = String(body.destinationName).trim();
    if (body.receivingWindow !== undefined)
      data.receivingWindow = String(body.receivingWindow).trim();
    if (body.incident !== undefined)
      data.incident = body.incident ? String(body.incident).trim() : null;
    if (body.salesRoute !== undefined)
      data.salesRoute = String(body.salesRoute).trim().toUpperCase();
    if (body.terminalId !== undefined && body.terminalId)
      data.terminalId = String(body.terminalId).trim();

    if (body.permitStatus !== undefined) {
      const nextStatus = String(body.permitStatus).trim().toUpperCase();

      if (
        (nextStatus === "APPROVED" || nextStatus === "REJECTED") &&
        session.role !== "ADMIN" &&
        session.role !== "APPROVER"
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
      } else if (nextStatus === "EMAILED") {
        data.lastEmailedAt = new Date();
      }
    }

    const dispatch = await prisma.dispatchRecord.update({
      where: { id },
      data,
      include: dispatchInclude,
    });

    return NextResponse.json({ dispatch });
  } catch (error) {
    console.error("Failed to update dispatch:", error);
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

  if (session.role !== "ADMIN" && session.role !== "APPROVER") {
    return NextResponse.json(
      { error: "Forbidden: Approver or Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    await prisma.dispatchRecord.delete({ where: { id } });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to delete dispatch:", error);
    return NextResponse.json(
      { error: "Failed to delete dispatch record." },
      { status: 500 }
    );
  }
}