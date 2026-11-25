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

export async function GET() {
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
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to load users from Neon." },
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role.trim() : "STAFF";
    const terminalId =
      typeof body.terminalId === "string" && body.terminalId.trim().length > 0
        ? body.terminalId.trim()
        : null;
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Invalid user role selected." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    }

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

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        role: role as "ADMIN" | "APPROVER" | "STAFF",
        terminalId,
        isActive,
      },
      select: userSelect,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user in Neon." },
      { status: 500 }
    );
  }
}