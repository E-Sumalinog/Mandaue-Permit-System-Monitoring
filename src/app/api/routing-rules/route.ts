import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

const DEFAULT_MODULE = "GOVT_PERMIT_EXPIRY";

function normalizeRecipientString(input: unknown): string {
  const list = Array.isArray(input)
    ? input.map((v) => String(v || "").trim().toLowerCase())
    : typeof input === "string"
      ? input.split(/[,;\n]+/).map((v) => v.trim().toLowerCase())
      : [];

  return Array.from(new Set(list.filter(Boolean))).join(", ");
}

function getPrismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const terminalId = searchParams.get("terminalId");
    const rawModule = searchParams.get("module");

    const where: Record<string, unknown> = {};
    if (terminalId && terminalId !== "ALL") {
      where.terminalId = terminalId;
    }
    if (rawModule && rawModule !== "ALL") {
      where.module = rawModule.trim().toUpperCase();
    }

    const rules = await prisma.emailRoutingRule.findMany({
      where,
      include: {
        terminal: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("GET /api/routing-rules error:", error);
    return NextResponse.json(
      { error: "Failed to load email routing rules." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (String(session.role || "").toUpperCase() !== "ADMIN") {
    return NextResponse.json(
      { error: "Only ADMIN users can create email routing rules." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const terminalId = String(body.terminalId || "").trim();

    const moduleName =
      typeof body.module === "string" && body.module.trim()
        ? body.module.trim().toUpperCase()
        : DEFAULT_MODULE;

    const filterKey =
      typeof body.filterKey === "string" && body.filterKey.trim()
        ? body.filterKey.trim().toUpperCase()
        : null;
    const toRecipients = normalizeRecipientString(body.toRecipients);
    const ccRecipients = normalizeRecipientString(body.ccRecipients);
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

    if (!terminalId || !toRecipients) {
      return NextResponse.json(
        { error: "Terminal and at least one TO recipient email are required." },
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

    const rule = await prisma.emailRoutingRule.create({
      data: {
        terminalId,
        module: moduleName,
        filterKey,
        toRecipients,
        ccRecipients,
        isActive,
      },
      include: {
        terminal: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("POST /api/routing-rules error:", error);

    const code = getPrismaErrorCode(error);
    if (code === "P2003") {
      return NextResponse.json(
        { error: "Invalid terminal reference on routing rule." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create email routing rule." },
      { status: 500 }
    );
  }
}