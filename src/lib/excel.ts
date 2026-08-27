import * as XLSX from "xlsx";
import type { CalendarEvent, Database } from "./types";
import { newId } from "./brain";
import { eventIdentity } from "./calendarIdentity";

export { eventIdentity };

export const CALENDAR_COLUMNS = [
  "Event name",
  "Type",
  "Date",
  "End date",
  "Campus",
  "Grades",
  "Notes",
] as const;

export type CalendarRowIssue = {
  row: number;
  field: string;
  value: string;
  suggestion?: string;
  message: string;
};

export type CalendarImportRow = {
  row: number;
  event: Omit<CalendarEvent, "id" | "approved" | "source">;
  issues: CalendarRowIssue[];
};

function closest(value: string, list: string[]) {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  const exact = list.find((x) => x.toLowerCase() === v);
  if (exact) return exact;
  const mapped = Object.entries(
    // filled by caller
    {} as Record<string, string>
  );
  void mapped;
  return list.find(
    (x) =>
      x.toLowerCase().includes(v) ||
      v.includes(x.toLowerCase().slice(0, 5))
  );
}

export function buildTemplateBuffer() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...CALENDAR_COLUMNS],
    [
      "Annual Sports Day",
      "Sports Day",
      "2026-09-15",
      "",
      "Clifton",
      "6-10",
      "Grades 6 to 10, Clifton campus",
    ],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Calendar");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseCalendarWorkbook(buf: Buffer, db: Database): CalendarImportRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });

  return json.map((raw, i) => {
    const name = String(raw["Event name"] ?? raw.Name ?? "").trim();
    const type = String(raw.Type ?? "").trim();
    const date = normalizeDate(String(raw.Date ?? "").trim());
    const endDate = normalizeDate(String(raw["End date"] ?? "").trim());
    const campus = String(raw.Campus ?? "").trim();
    const grades = String(raw.Grades ?? "").trim();
    const notes = String(raw.Notes ?? "").trim();
    const issues: CalendarRowIssue[] = [];
    const row = i + 2;

    if (!name) issues.push({ row, field: "Event name", value: "", message: "Name is required" });
    if (!date)
      issues.push({
        row,
        field: "Date",
        value: String(raw.Date ?? ""),
        message: "Use YYYY-MM-DD",
      });

    const typeFix =
      db.vocab.extraSpellings[type.toLowerCase()] ||
      closest(type, db.vocab.eventTypes) ||
      type;
    if (type && typeFix !== type) {
      issues.push({
        row,
        field: "Type",
        value: type,
        suggestion: typeFix,
        message: `Did you mean ${typeFix}?`,
      });
    }

    const campusFix =
      db.vocab.extraSpellings[campus.toLowerCase()] ||
      closest(campus, db.vocab.campuses) ||
      campus;
    if (campus && campusFix !== campus) {
      issues.push({
        row,
        field: "Campus",
        value: campus,
        suggestion: campusFix,
        message: `Did you mean ${campusFix}?`,
      });
    }

    if (campus && !db.vocab.campuses.some((c) => c.toLowerCase() === campusFix.toLowerCase())) {
      issues.push({
        row,
        field: "Campus",
        value: campus,
        message: "Campus is not in School Brain",
      });
    }

    return {
      row,
      event: {
        name,
        type: typeFix || type,
        date: date || String(raw.Date ?? ""),
        endDate: endDate || undefined,
        campus: campusFix || campus,
        grades: grades || undefined,
        notes: notes || undefined,
      },
      issues,
    };
  });
}

function normalizeDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function toCalendarEvents(rows: CalendarImportRow[]): CalendarEvent[] {
  return rows.map((r) => ({
    id: newId("cal"),
    ...r.event,
    source: "excel",
    approved: true,
  }));
}
