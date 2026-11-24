import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const logs = await prisma.emailLog.findMany({
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