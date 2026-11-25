import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const terminals = await prisma.terminal.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ terminals });
  } catch (error) {
    console.error("Failed to fetch terminals:", error);
    return NextResponse.json(
      { error: "Failed to load terminals from Neon." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const location =
      typeof body.location === "string" && body.location.trim().length > 0
        ? body.location.trim()
        : null;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Terminal code and name are required." },
        { status: 400 }
      );
    }

    const terminal = await prisma.terminal.create({
      data: { code, name, location },
    });

    return NextResponse.json({ terminal }, { status: 201 });
  } catch (error) {
    console.error("Failed to create terminal:", error);
    return NextResponse.json(
      { error: "Failed to create terminal." },
      { status: 500 }
    );
  }
}