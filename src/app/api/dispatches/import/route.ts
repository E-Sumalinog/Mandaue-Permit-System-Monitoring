import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFirstNonEmptyValue(row: Record<string, unknown>): string {
  for (const val of Object.values(row)) {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return "";
}

function getValueByKeyword(
  row: Record<string, unknown>,
  keywords: string[]
): string {
  const normalizedKeywords = keywords.map((kw) => normalizeKey(kw));
  for (const [key, val] of Object.entries(row)) {
    if (val === undefined || val === null || String(val).trim() === "") {
      continue;
    }
    const normalizedHeader = normalizeKey(key);
    if (normalizedKeywords.some((kw) => normalizedHeader.includes(kw))) {
      return String(val).trim();
    }
  }
  return "";
}

function findHeaderRowIndex(matrix: unknown[][]): number {
  let bestIndex = 0;
  let bestScore = -1;

  const limit = Math.min(matrix.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    const nonEmptyCells = row.filter(
      (cell) => cell !== undefined && cell !== null && String(cell).trim() !== ""
    );
    if (nonEmptyCells.length >= 2 && nonEmptyCells.length > bestScore) {
      bestScore = nonEmptyCells.length;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const requestedTerminalId = formData.get("terminalId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please attach a .csv, .xls, or .xlsx file." },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    if (
      !fileName.endsWith(".csv") &&
      !fileName.endsWith(".xls") &&
      !fileName.endsWith(".xlsx")
    ) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload .csv, .xls, or .xlsx." },
        { status: 400 }
      );
    }

    let terminalId =
      typeof requestedTerminalId === "string" && requestedTerminalId.trim()
        ? requestedTerminalId.trim()
        : null;

    if (!terminalId) {
      const defaultTerminal = await prisma.terminal.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      terminalId = defaultTerminal?.id ?? null;
    }

    if (!terminalId) {
      return NextResponse.json(
        { error: "No active terminal found in Neon." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json(
        { error: "The uploaded spreadsheet has no sheets." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    });

    const headerRowIndex = findHeaderRowIndex(matrix);
    const detectedHeaders = (matrix[headerRowIndex] ?? [])
      .map((h) => String(h).trim())
      .filter(Boolean);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      range: headerRowIndex,
      defval: "",
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in the uploaded file." },
        { status: 400 }
      );
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = headerRowIndex + index + 2;

      const hasAnyValue = Object.values(row).some(
        (v) => v !== undefined && v !== null && String(v).trim() !== ""
      );

      if (!hasAnyValue) {
        skippedCount++;
        continue;
      }

      const firstVal = getFirstNonEmptyValue(row);
      const firstSlug =
        firstVal
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 14) || "ROW";

      const matchedTruck = getValueByKeyword(row, [
        "truck",
        "plate",
        "vehicle",
        "tanker",
        "unit",
      ]);
      const matchedOrder = getValueByKeyword(row, [
        "order",
        "so",
        "delivery",
        "trip",
        "shipment",
        "ticket",
        "id",
      ]);

      const truck = (
        matchedTruck || `${firstSlug}-R${String(rowNum).padStart(3, "0")}`
      ).toUpperCase();

      const orderNumber = (
        matchedOrder || `IMP-${firstSlug}-${String(rowNum).padStart(4, "0")}`
      ).toUpperCase();

      const sourcePlant =
        getValueByKeyword(row, ["plant", "depot", "source", "terminal"]) ||
        "Mandaue Depot";

      const priority = (
        getValueByKeyword(row, ["priority", "urgency", "level"]) || "NORMAL"
      ).toUpperCase();

      const shipToNumber = (
        getValueByKeyword(row, ["shipto", "ship", "customer", "client", "pay"]) ||
        "N/A"
      )
        .toUpperCase()
        .slice(0, 24);

      const destinationName =
        getValueByKeyword(row, [
          "destination",
          "dest",
          "customer",
          "name",
          "location",
          "channel",
        ]) ||
        firstVal ||
        `Imported Row ${rowNum}`;

      const receivingWindow =
        getValueByKeyword(row, ["window", "schedule", "time"]) ||
        "08:00 - 17:00";

      const incident =
        getValueByKeyword(row, [
          "incident",
          "remark",
          "note",
          "issue",
          "cancel",
        ]) || null;

      const salesRoute = (
        getValueByKeyword(row, ["route", "lane", "zone", "channel"]) ||
        "DEFAULT-ROUTE"
      )
        .toUpperCase()
        .replace(/[^A-Z0-9-]+/g, "-")
        .replace(/^-|-$/g, "") || "DEFAULT-ROUTE";

      await prisma.dispatchRecord.upsert({
        where: {
          orderNumber_truck: {
            orderNumber,
            truck,
          },
        },
        update: {
          terminalId,
          sourcePlant,
          priority,
          shipToNumber,
          destinationName,
          receivingWindow,
          incident,
          salesRoute,
        },
        create: {
          terminalId,
          sourcePlant,
          truck,
          priority,
          orderNumber,
          shipToNumber,
          destinationName,
          receivingWindow,
          incident,
          salesRoute,
          permitStatus: "PENDING",
        },
      });

      importedCount++;
    }

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
      headerRowIndex,
      headers: detectedHeaders,
      rawRows: rows,
    });
  } catch (error) {
    console.error("Failed to import dispatcher file:", error);
    const message =
      error instanceof Error ? error.message : "Failed to import file.";
    return NextResponse.json(
      { error: `Import error: ${message}` },
      { status: 500 }
    );
  }
}