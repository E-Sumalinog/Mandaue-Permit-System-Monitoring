export type GovtPermitCategory =
  | "AIR"
  | "WATER"
  | "HAZWASTE"
  | "BIR"
  | "PTO"
  | "BUSINESS";

export type GovPermitStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

export interface GovernmentPermit {
  id: string;
  category: GovtPermitCategory;
  permitNumber: string;
  permitName: string;
  issuingAgency: string;
  terminal: string;
  issueDate: string;
  expiryDate: string;
  daysRemaining: number;
  status: GovPermitStatus;
  lastReminderSent: string | null;
}

export type MaintenanceCategory = "TANKS" | "VALVE_GAUGE" | "OTHERS";
export type AssetCondition = "NORMAL" | "WARNING" | "CRITICAL" | "UNDER_MAINTENANCE";

export interface MaintenanceAsset {
  id: string;
  category: MaintenanceCategory;
  assetCode: string;
  parentValve?: string; // Links Pressure Gauge -> Valve per client sketch
  name: string;
  terminal: string;
  currentPsi?: number;
  minPsi?: number;
  maxPsi?: number;
  temperatureC?: number;
  nextServiceDate: string;
  condition: AssetCondition;
  lastCheckedAt: string;
  checkedBy: string;
  remarks: string;
}

export const MOCK_GOV_PERMITS: GovernmentPermit[] = [
  {
    id: "gp-1",
    category: "AIR",
    permitNumber: "DENR-POA-R07-2026-104",
    permitName: "Permit to Operate Air Pollution Source Installation (APSI)",
    issuingAgency: "DENR-EMB Region VII",
    terminal: "Mandaue Terminal",
    issueDate: "2026-02-10",
    expiryDate: "2027-02-10",
    daysRemaining: 78,
    status: "ACTIVE",
    lastReminderSent: null,
  },
  {
    id: "gp-2",
    category: "WATER",
    permitNumber: "DENR-WDP-R07-2025-882",
    permitName: "Wastewater Discharge Permit (Oil-Water Separator)",
    issuingAgency: "DENR-EMB Region VII",
    terminal: "Mandaue Terminal",
    issueDate: "2025-12-12",
    expiryDate: "2026-12-12",
    daysRemaining: 18,
    status: "EXPIRING_SOON",
    lastReminderSent: "2026-11-22 08:00 AM",
  },
  {
    id: "gp-3",
    category: "HAZWASTE",
    permitNumber: "HWG-ID-R07-00491",
    permitName: "Hazardous Waste Generator Registration & TSD Manifest",
    issuingAgency: "DENR-EMB Region VII",
    terminal: "Mandaue Terminal",
    issueDate: "2025-11-15",
    expiryDate: "2026-11-15",
    daysRemaining: -9,
    status: "EXPIRED",
    lastReminderSent: "2026-11-15 07:30 AM",
  },
  {
    id: "gp-4",
    category: "BIR",
    permitNumber: "BIR-COR-080-2026-331",
    permitName: "BIR Certificate of Registration & Loose-Leaf Books Permit",
    issuingAgency: "BIR RDO 080 Mandaue",
    terminal: "Mandaue Terminal",
    issueDate: "2026-01-05",
    expiryDate: "2027-01-31",
    daysRemaining: 68,
    status: "ACTIVE",
    lastReminderSent: null,
  },
  {
    id: "gp-5",
    category: "PTO",
    permitNumber: "DOLE-PTO-MECH-2026-512",
    permitName: "Permit to Operate Pressure Vessels & Piping Systems",
    issuingAgency: "DOLE Region VII",
    terminal: "Mandaue Terminal",
    issueDate: "2025-12-20",
    expiryDate: "2026-12-20",
    daysRemaining: 26,
    status: "EXPIRING_SOON",
    lastReminderSent: null,
  },
  {
    id: "gp-6",
    category: "BUSINESS",
    permitNumber: "LGU-MND-BP-2026-9014",
    permitName: "Mandaue City Mayor's Business & Depot Operations Permit",
    issuingAgency: "City Government of Mandaue",
    terminal: "Mandaue Terminal",
    issueDate: "2026-01-18",
    expiryDate: "2027-01-20",
    daysRemaining: 57,
    status: "ACTIVE",
    lastReminderSent: null,
  },
];

export const MOCK_MAINTENANCE_ASSETS: MaintenanceAsset[] = [
  // TANKS
  {
    id: "m-1",
    category: "TANKS",
    assetCode: "TK-101",
    name: "Bulk Storage Tank 101 (Diesel Max)",
    terminal: "Mandaue Terminal",
    currentPsi: 42.5,
    minPsi: 30,
    maxPsi: 55,
    temperatureC: 31.2,
    nextServiceDate: "2027-01-15",
    condition: "NORMAL",
    lastCheckedAt: "Today 11:30 AM",
    checkedBy: "J. Santos",
    remarks: "Breather valve and tank shell integrity normal.",
  },
  {
    id: "m-2",
    category: "TANKS",
    assetCode: "TK-102",
    name: "Bulk Storage Tank 102 (XCS Gasoline)",
    terminal: "Mandaue Terminal",
    currentPsi: 51.8,
    minPsi: 30,
    maxPsi: 55,
    temperatureC: 33.9,
    nextServiceDate: "2026-12-05",
    condition: "WARNING",
    lastCheckedAt: "Today 12:10 PM",
    checkedBy: "Engr. R. Villanueva",
    remarks: "Approaching upper PSI threshold; monitor afternoon ambient heat.",
  },
  // VALVE -> PRESSURE GAUGE
  {
    id: "m-3",
    category: "VALVE_GAUGE",
    assetCode: "PG-VLV-04",
    parentValve: "Main Manifold Valve VLV-04",
    name: "Line Pressure Gauge #04 (Loading Bay 1)",
    terminal: "Mandaue Terminal",
    currentPsi: 63.4,
    minPsi: 35,
    maxPsi: 60,
    temperatureC: 34.5,
    nextServiceDate: "2026-11-30",
    condition: "CRITICAL",
    lastCheckedAt: "Today 12:25 PM",
    checkedBy: "J. Santos",
    remarks: "Pressure spike detected downstream of VLV-04; relief check needed.",
  },
  {
    id: "m-4",
    category: "VALVE_GAUGE",
    assetCode: "PG-VLV-07",
    parentValve: "Discharge Header Valve VLV-07",
    name: "Line Pressure Gauge #07 (Transfer Pump Line)",
    terminal: "Mandaue Terminal",
    currentPsi: 46.0,
    minPsi: 35,
    maxPsi: 60,
    temperatureC: 30.8,
    nextServiceDate: "2027-02-15",
    condition: "NORMAL",
    lastCheckedAt: "Today 10:45 AM",
    checkedBy: "J. Santos",
    remarks: "Calibrated and steady within operating range.",
  },
  // OTHERS
  {
    id: "m-5",
    category: "OTHERS",
    assetCode: "PMP-B2-01",
    name: "Loading Gantry Transfer Pump & Strainer #1",
    terminal: "Mandaue Terminal",
    nextServiceDate: "2026-11-28",
    condition: "UNDER_MAINTENANCE",
    lastCheckedAt: "Today 09:00 AM",
    checkedBy: "Maintenance Crew A",
    remarks: "Scheduled mechanical seal replacement in progress.",
  },
  {
    id: "m-6",
    category: "OTHERS",
    assetCode: "FFP-02",
    name: "Foam Fire Suppression Booster System",
    terminal: "Mandaue Terminal",
    nextServiceDate: "2027-01-10",
    condition: "NORMAL",
    lastCheckedAt: "Yesterday 04:00 PM",
    checkedBy: "Safety Officer",
    remarks: "Weekly test run passed; foam concentrate level 100%.",
  },
];