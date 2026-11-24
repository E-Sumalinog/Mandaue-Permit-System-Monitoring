import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

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