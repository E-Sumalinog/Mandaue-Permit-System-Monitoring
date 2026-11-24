export type PermitStatus = "PENDING" | "APPROVED" | "EMAILED" | "REJECTED";

export interface DispatchRecord {
  id: string;
  terminalInfo: string;
  sourcePlant: string;
  truck: string;
  priority: "HIGH" | "NORMAL" | "URGENT";
  orderNumber: string;
  shipToNumber: string;
  destinationName: string;
  receivingWindow: string;
  incident: string | null;
  salesRoute: string;
  permitStatus: PermitStatus;
  lastEmailedAt: string | null;
}

export const MOCK_DISPATCHES: DispatchRecord[] = [
  {
    id: "1",
    terminalInfo: "Mandaue Terminal",
    sourcePlant: "CEB-01",
    truck: "GAE-4821",
    priority: "URGENT",
    orderNumber: "ORD-90412",
    shipToNumber: "SHP-1004",
    destinationName: "Petron Ayala Access Road",
    receivingWindow: "08:00 - 11:00",
    incident: null,
    salesRoute: "CEBU-NORTH-01",
    permitStatus: "EMAILED",
    lastEmailedAt: "2026-11-24 07:45 AM",
  },
  {
    id: "2",
    terminalInfo: "Mandaue Terminal",
    sourcePlant: "CEB-01",
    truck: "NFW-7730",
    priority: "HIGH",
    orderNumber: "ORD-90415",
    shipToNumber: "SHP-1029",
    destinationName: "Petron SRP Talisay",
    receivingWindow: "09:30 - 12:30",
    incident: null,
    salesRoute: "CEBU-SOUTH-02",
    permitStatus: "APPROVED",
    lastEmailedAt: null,
  },
  {
    id: "3",
    terminalInfo: "Mandaue Terminal",
    sourcePlant: "CEB-02",
    truck: "CBP-1194",
    priority: "NORMAL",
    orderNumber: "ORD-90419",
    shipToNumber: "SHP-1088",
    destinationName: "Petron Lapu-Lapu Pusok",
    receivingWindow: "10:00 - 14:00",
    incident: "Delayed at Gate 2",
    salesRoute: "MACTAN-01",
    permitStatus: "PENDING",
    lastEmailedAt: null,
  },
  {
    id: "4",
    terminalInfo: "Bacolod Depot",
    sourcePlant: "BCD-01",
    truck: "FAG-9920",
    priority: "NORMAL",
    orderNumber: "ORD-90422",
    shipToNumber: "SHP-2011",
    destinationName: "Petron Lacson Mandalagan",
    receivingWindow: "13:00 - 16:00",
    incident: null,
    salesRoute: "NEG-OCC-04",
    permitStatus: "PENDING",
    lastEmailedAt: null,
  },
];