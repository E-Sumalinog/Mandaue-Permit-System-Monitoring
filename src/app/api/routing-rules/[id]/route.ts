import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (String(session.role || "").toUpperCase() !== "ADMIN") {
    return NextResponse.json(
      { error: "Only ADMIN users can update email routing rules." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const ruleId = id?.trim();

    if (!ruleId) {
      return NextResponse.json(
        { error: "Routing rule ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.module !== undefined) {
      const normalizedModule = String(body.module || "").trim().toUpperCase();
      if (!normalizedModule) {
        return NextResponse.json(
          { error: "Module cannot be empty." },
          { status: 400 }
        );
      }
      data.module = normalizedModule;
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    if (body.filterKey !== undefined) {
      data.filterKey =
        typeof body.filterKey === "string" && body.filterKey.trim()
          ? body.filterKey.trim().toUpperCase()
          : null;
    }

    if (body.toRecipients !== undefined) {
      const parsedTo = normalizeRecipientString(body.toRecipients);
      if (!parsedTo) {
        return NextResponse.json(
          { error: "At least one TO recipient email is required." },
          { status: 400 }
        );
      }
      data.toRecipients = parsedTo;
    }

    if (body.ccRecipients !== undefined) {
      data.ccRecipients = normalizeRecipientString(body.ccRecipients);
    }

    const rule = await prisma.emailRoutingRule.update({
      where: { id: ruleId },
      data,
      include: {
        terminal: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("PATCH /api/routing-rules/[id] error:", error);

    const code = getPrismaErrorCode(error);
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Routing rule not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update email routing rule." },
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

  if (String(session.role || "").toUpperCase() !== "ADMIN") {
    return NextResponse.json(
      { error: "Only ADMIN users can delete email routing rules." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const ruleId = id?.trim();

    if (!ruleId) {
      return NextResponse.json(
        { error: "Routing rule ID is required." },
        { status: 400 }
      );
    }

    await prisma.emailRoutingRule.delete({ where: { id: ruleId } });
    return NextResponse.json({ success: true, id: ruleId });
  } catch (error) {
    console.error("DELETE /api/routing-rules/[id] error:", error);

    const code = getPrismaErrorCode(error);
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Routing rule not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete email routing rule." },
      { status: 500 }
    );
  }
}