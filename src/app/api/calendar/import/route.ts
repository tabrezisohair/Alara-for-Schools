import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import {
  eventIdentity,
  parseCalendarWorkbook,
  toCalendarEvents,
} from "@/lib/excel";
import { readDb, updateDb } from "@/lib/store";

export async function POST(request: Request) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const db = await readDb();
  const parsed = parseCalendarWorkbook(buf, db);
  const confirm = form.get("confirm") === "true";
  if (!confirm) {
    return Response.json({ rows: parsed });
  }
  const incoming = toCalendarEvents(parsed);
  const existing = new Set(db.calendar.map(eventIdentity));
  const seen = new Set<string>();
  const added: typeof incoming = [];
  const duplicates: typeof incoming = [];
  for (const event of incoming) {
    const key = eventIdentity(event);
    if (!event.name || !event.date || existing.has(key) || seen.has(key)) {
      if (event.name && event.date) duplicates.push(event);
      continue;
    }
    seen.add(key);
    added.push(event);
  }
  const next = await updateDb((current) => {
    current.calendar.push(...added);
    return current;
  });
  return Response.json({
    rows: parsed,
    added: added.length,
    duplicates: duplicates.map((event) => ({
      name: event.name,
      date: event.date,
      campus: event.campus,
      type: event.type,
    })),
    calendar: next.calendar,
  });
}
