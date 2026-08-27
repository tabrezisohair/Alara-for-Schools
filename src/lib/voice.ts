import type { Brief, Database, Intent } from "./types";

const MONTHS: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

export type VoiceFill = {
  intent?: Intent;
  brief: Brief;
  filled: string[];
  missing: string[];
  transcript: string;
};

function yearFrom(month: string, day: string) {
  const now = new Date();
  const y = now.getFullYear();
  const candidate = new Date(`${y}-${month}-${day}T00:00:00`);
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return String(y + 1);
  }
  return String(y);
}

function parseDate(text: string): string | undefined {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${m}-${d}`;
  }
  const named = text.match(
    /\b(\d{1,2})\s*(st|nd|rd|th)?\s*(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i
  );
  if (named) {
    const d = named[1].padStart(2, "0");
    const m = MONTHS[named[3].toLowerCase()];
    return `${yearFrom(m, d)}-${m}-${d}`;
  }
  const named2 = text.match(
    /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})\b/i
  );
  if (named2) {
    const d = named2[2].padStart(2, "0");
    const m = MONTHS[named2[1].toLowerCase()];
    return `${yearFrom(m, d)}-${m}-${d}`;
  }
  return undefined;
}

function parseGrades(text: string): string[] | undefined {
  const range = text.match(
    /(?:grade|grades|class|classes|jammat|jamaat|جماعت)?\s*(\d{1,2})\s*(?:se|to|–|-|تا|سے)\s*(\d{1,2})/i
  );
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const out: string[] = [];
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(String(i));
    return out;
  }
  const list = [...text.matchAll(/\bgrade\s+(\d{1,2})\b/gi)].map((m) => m[1]);
  if (list.length) return list;
  return undefined;
}

export function parseVoice(transcript: string, db: Database): VoiceFill {
  const raw = transcript.trim();
  const t = raw.toLowerCase();
  const brief: Brief = {};
  const filled: string[] = [];

  let intent: Intent | undefined;
  if (
    /admission|daakhla|داخلہ|apply|enrol|enroll/.test(t)
  ) {
    intent = "admissions";
  } else if (
    /result|winner|jeet|won|medal|trophy|achievement|مقابل/.test(t)
  ) {
    intent = "achievement";
  } else if (
    /band|bandh|closure|closed|chutti|holiday|exam schedule|papers|policy|meeting|pta|ptm|اطلاع|بند/.test(
      t
    )
  ) {
    intent = "announcement";
  } else if (/teacher spotlight|campus tour|facilit|student life/.test(t)) {
    intent = "showcase";
  } else if (
    /sports? day|annual day|science fair|independence|cultural day|field trip|debate|exhibition|سپورٹ/.test(
      t
    )
  ) {
    intent = "event";
  }

  const campus = db.vocab.campuses.find((c) =>
    t.includes(c.toLowerCase())
  );
  if (campus) {
    brief.campus = campus;
    filled.push("campus");
  } else if (/cliffton|کلفٹن/.test(t)) {
    brief.campus = "Clifton";
    filled.push("campus");
  }

  const eventType = db.vocab.eventTypes.find((e) =>
    t.includes(e.toLowerCase())
  );
  if (eventType) {
    brief.eventType = eventType;
    filled.push("eventType");
    if (!intent) intent = "event";
  } else if (/sports? day|سپورٹ/.test(t)) {
    brief.eventType = "Sports Day";
    filled.push("eventType");
    if (!intent) intent = "event";
  }

  const date = parseDate(t);
  if (date) {
    brief.date = date;
    filled.push("date");
  }

  const grades = parseGrades(t);
  if (grades) {
    brief.grades = grades;
    filled.push("grades");
  }

  if (/instagram|ig\b/.test(t) || /whatsapp|واٹس/.test(t)) {
    filled.push("channels");
  }

  if (/register|dakhla form/.test(t)) brief.parentAction = "Register";
  else if (/kit|uniform|sports kit/.test(t)) {
    brief.parentAction = "Bring students in sports kit";
  } else if (intent === "event") brief.parentAction = "Just inform";
  if (brief.parentAction) filled.push("parentAction");

  if (/open/.test(t) && intent === "admissions") brief.admissionsGoal = "Awareness";
  if (/deadline|last date|akhri/.test(t) && intent === "admissions") {
    brief.admissionsGoal = "Deadline";
  }

  if (/closure|bandh|band hai|closed/.test(t)) {
    brief.announcementType = "School closure";
    filled.push("announcementType");
  } else if (/exam|paper/.test(t) && intent === "announcement") {
    brief.announcementType = "Exam schedule";
    filled.push("announcementType");
  }

  const leftover = raw.length > 180 ? raw.slice(0, 180) : raw;
  if (leftover) {
    brief.extraNotes = leftover;
    filled.push("extraNotes");
  }

  const required: Record<string, string[]> = {
    event: ["eventType", "campus", "date", "grades", "parentAction"],
    announcement: ["announcementType", "audience"],
    achievement: ["achievement"],
    admissions: ["admissionsGoal"],
    showcase: ["showcaseType"],
    photos_to_post: [],
    other: ["otherCategory"],
  };

  const missing = (intent ? required[intent] : ["intent"]).filter(
    (k) => !filled.includes(k) && !(brief as Record<string, unknown>)[k]
  );

  return { intent, brief, filled, missing, transcript: raw };
}
