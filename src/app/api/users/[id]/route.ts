import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession, hashPassword } from "@/lib/auth";

const VALID_ROLES = new Set(["ADMIN", "APPROVER", "STAFF"]);

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  terminalId: true,
  terminal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const body = await req.json();

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const data: {
      name?: string;
      email?: string;
      role?: "ADMIN" | "APPROVER" | "STAFF";
      terminalId?: string | null;
      isActive?: boolean;
      passwordHash?: string;
    } = {};

    if (typeof body.name === "string") {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "Name cannot be empty." },
          { status: 400 }
        );
      }
      data.name = trimmedName;
    }

    if (typeof body.email === "string") {
      const normalizedEmail = body.email.trim().toLowerCase();
      if (!normalizedEmail) {
        return NextResponse.json(
          { error: "Email cannot be empty." },
          { status: 400 }
        );
      }
      if (normalizedEmail !== targetUser.email) {
        const duplicate = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Another user already uses this email." },
            { status: 409 }
          );
        }
      }
      data.email = normalizedEmail;
    }

    if (typeof body.role === "string") {
      const role = body.role.trim();
      if (!VALID_ROLES.has(role)) {
        return NextResponse.json(
          { error: "Invalid user role selected." },
          { status: 400 }
        );
      }
      data.role = role as "ADMIN" | "APPROVER" | "STAFF";
    }

    if (body.terminalId !== undefined) {
      const terminalId =
        typeof body.terminalId === "string" && body.terminalId.trim().length > 0
          ? body.terminalId.trim()
          : null;

      if (terminalId) {
        const terminal = await prisma.terminal.findUnique({
          where: { id: terminalId },
          select: { id: true },
        });
        if (!terminal) {
          return NextResponse.json(
            { error: "Selected terminal was not found." },
            { status: 400 }
          );
        }
      }
      data.terminalId = terminalId;
    }

    if (typeof body.isActive === "boolean") {
      if (session.userId === id && body.isActive === false) {
        return NextResponse.json(
          { error: "You cannot deactivate your own active account." },
          { status: 400 }
        );
      }
      data.isActive = body.isActive;
    }

    if (typeof body.password === "string" && body.password.trim().length > 0) {
      if (body.password.trim().length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters." },
          { status: 400 }
        );
      }
      data.passwordHash = hashPassword(body.password.trim());
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user in Neon." },
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

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    if (session.userId === id) {
      return NextResponse.json(
        { error: "You cannot delete your own active admin account." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { error: "Failed to delete user from Neon." },
      { status: 500 }
    );
  }
}