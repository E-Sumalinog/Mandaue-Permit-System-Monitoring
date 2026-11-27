import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

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
      where.status = status;
    }

    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Failed to fetch email logs:", error);
    return NextResponse.json(
      { error: "Failed to load email audit logs." },
      { status: 500 }
    );
  }
}