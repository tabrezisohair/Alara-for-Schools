import { createHash } from "crypto";
import {
  ADMISSIONS_BEATS,
  DEFAULT_CHANNELS,
  EVENT_BEATS,
  GRADE_OPTIONS,
} from "./constants";
import {
  isPosterSafeAsset,
  namedPerson,
} from "./schoolRules";
import type {
  BrainPacket,
  Brief,
  CalendarEvent,
  CaptionSet,
  Channel,
  ContentJob,
  Database,
  Intent,
} from "./types";

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function contentHash(
  job: Pick<
    ContentJob,
    "outputs" | "captions" | "assets" | "channels" | "scheduledFor"
  >
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        outputs: job.outputs.map((o) => ({
          format: o.format,
          channel: o.channel,
          imageUrl: o.imageUrl,
        })),
        captions: job.captions,
        assets: job.assets,
        channels: job.channels,
        scheduledFor: job.scheduledFor ?? "",
      })
    )
    .digest("hex");
}

export function selectTemplate(intent: Intent, brief: Brief, beat?: string) {
  if (intent === "event") {
    if (beat === "remind") return "event.remind";
    if (beat === "recap") return "event.recap";
    const type = (brief.eventType ?? "event").toLowerCase().replace(/\s+/g, "_");
    return `event.${type}.announce`;
  }
  if (intent === "announcement") {
    const type = (brief.announcementType ?? "notice")
      .toLowerCase()
      .replace(/\s+/g, "_");
    return `announcement.${type}`;
  }
  if (intent === "achievement") return "people.achievement";
  if (intent === "admissions") {
    return beat ? `admissions.${beat}` : "admissions.open";
  }
  if (intent === "showcase") {
    const type = (brief.showcaseType ?? "school")
      .toLowerCase()
      .replace(/\s+/g, "_");
    return `showcase.${type}`;
  }
  if (intent === "photos_to_post") return "photos.carousel";
  return `other.${(brief.otherCategory ?? "general")
    .toLowerCase()
    .replace(/\s+/g, "_")}`;
}

export function schoolShortName(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

export function kickerFor(
  intent: Intent,
  brief: Brief,
  beat?: string,
  schoolName?: string
) {
  const school = schoolName ? schoolShortName(schoolName).toUpperCase() : "THE SCHOOL";
  if (beat === "remind") return "REMINDER";
  if (beat === "recap") return "THANK YOU";
  if (intent === "event") return (brief.eventType ?? "Event").toUpperCase();
  if (intent === "announcement") {
    return (brief.announcementType ?? "Announcement").toUpperCase();
  }
  if (intent === "achievement") return "CONGRATULATIONS";
  if (intent === "admissions") {
    if (beat === "trust") return `WHY ${school}`;
    if (beat === "conversion") return "APPLY NOW";
    if (brief.admissionsGoal === "Deadline") return "CLOSING SOON";
    return "ADMISSIONS";
  }
  if (intent === "showcase") {
    return (brief.showcaseType ?? "Our school").toUpperCase();
  }
  if (intent === "photos_to_post") return "CAMPUS LIFE";
  return (brief.otherCategory ?? "Notice").toUpperCase();
}

export function headlineFor(db: Database, intent: Intent, brief: Brief) {
  const school = schoolShortName(db.school.name);
  if (intent === "event") return brief.eventName || brief.eventType || "School event";
  if (intent === "announcement") {
    if (brief.announcementType === "School closure") return "Campus closed";
    if (brief.announcementType === "Exam schedule") return "Exam dates announced";
    if (brief.announcementType === "Holiday notice") return "Holiday announced";
    if (brief.announcementType === "Parent meeting") return "Parents, please note";
    if (brief.announcementType === "New policy") return "A note for families";
    if (brief.announcementType === "Reminder") return "Please remember";
    return brief.announcementType || "Important announcement";
  }
  if (intent === "achievement") {
    return namedPerson(brief) || `Well done, ${school}`;
  }
  if (intent === "admissions") {
    if (brief.admissionsGoal === "Deadline") return "Applications close soon";
    if (brief.admissionsGoal === "Tour") return "Visit our campus";
    return "Admissions open";
  }
  if (intent === "showcase") return brief.showcaseType || `Life at ${school}`;
  if (intent === "photos_to_post") {
    return "From campus";
  }
  return brief.otherCategory || `From ${school}`;
}

function formatGrades(grades: string[]) {
  const ordered = [...grades].sort(
    (a, b) => GRADE_OPTIONS.indexOf(a) - GRADE_OPTIONS.indexOf(b)
  );
  if (ordered.length === 1) return `Grade ${ordered[0]}`;
  return `Grades ${ordered[0]}–${ordered[ordered.length - 1]}`;
}

export function metaLines(brief: Brief): string[] {
  const lines: string[] = [];
  if (brief.date) {
    const formatted = formatDate(brief.date);
    lines.push(brief.time ? `${formatted}  ·  ${formatTime(brief.time)}` : formatted);
  }
  if (brief.campus) lines.push(`${brief.campus} Campus`);
  if (brief.audience) lines.push(brief.audience);
  if (brief.grades?.length) lines.push(formatGrades(brief.grades));
  if (brief.deadline) lines.push(`Deadline ${formatDate(brief.deadline)}`);
  if (brief.endDate && brief.announcementType === "School closure") {
    lines.push(`Until ${formatDate(brief.endDate)}`);
  }
  return lines;
}

export function formatTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  if (Number.isNaN(hour) || hour > 23) return value;
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return minute === "00" ? `${hour12} ${suffix}` : `${hour12}:${minute} ${suffix}`;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ctaFor(intent: Intent, brief: Brief) {
  if (brief.cta) return brief.cta;
  if (intent === "event") {
    if (brief.parentAction === "Register") return "Register with the school office";
    if (brief.parentAction === "Bring students in sports kit") {
      return "Sports kit required";
    }
    if (brief.parentAction === "I'll tell you" && brief.parentActionNote) {
      return brief.parentActionNote.slice(0, 48);
    }
    return "See you there";
  }
  if (intent === "admissions") return brief.cta || "Enquire today";
  if (intent === "announcement" && brief.severity === "Urgent") return "Please note";
  return "";
}

export function clashWarning(calendar: CalendarEvent[], date?: string) {
  if (!date) return undefined;
  const t = new Date(`${date}T00:00:00Z`).getTime();
  const exam = calendar.find((c) => {
    if (!c.approved) return false;
    const isExam = /exam/i.test(c.type) || /exam/i.test(c.name);
    if (!isExam) return false;
    const start = new Date(`${c.date}T00:00:00Z`).getTime();
    const end = new Date(`${c.endDate ?? c.date}T00:00:00Z`).getTime();
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    return (
      Math.abs(start - t) <= twoDays ||
      (t >= start - twoDays && t <= end + twoDays)
    );
  });
  if (!exam) return undefined;
  return `${exam.name} ${
    exam.date === date ? "is the same day" : `is nearby (${formatDate(exam.date)})`
  }. Post anyway?`;
}

export function assemblePacket(
  db: Database,
  job: {
    intent: Intent;
    brief: Brief;
    channels: Channel[];
    captionLanguage: "en" | "ur" | "both";
    posterLanguage: "en" | "ur";
    beat?: BrainPacket["job"]["beat"];
    assetIds?: string[];
  }
): BrainPacket {
  const assets = (job.assetIds ?? [])
    .map((id) => db.assets.find((a) => a.id === id))
    .filter(isPosterSafeAsset)
    .map((a) => ({ id: a.id, url: a.url, flag: a.flag }));

  const nearby = db.calendar.filter((c) => {
    if (!c.approved || !job.brief.date) return false;
    const t = new Date(`${job.brief.date}T00:00:00Z`).getTime();
    const d = new Date(`${c.date}T00:00:00Z`).getTime();
    return Math.abs(d - t) <= 14 * 24 * 60 * 60 * 1000;
  });

  const recentMix = db.jobs
    .filter((j) => j.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 8)
    .map((j) => j.intent);

  return {
    id: newId("pkt"),
    createdAt: new Date().toISOString(),
    brand: db.brand,
    facts: db.school,
    tone: db.tone,
    job: {
      intent: job.intent,
      brief: job.brief,
      beat: job.beat,
      channels: job.channels,
      captionLanguage: job.captionLanguage,
      posterLanguage: job.posterLanguage,
    },
    assets,
    nearbyCalendar: nearby,
    recentMix,
    templateId: selectTemplate(job.intent, job.brief, job.beat),
    clashWarning: clashWarning(db.calendar, job.brief.date),
  };
}

export function writeCaptions(
  db: Database,
  packet: BrainPacket
): Partial<Record<Channel, CaptionSet>> {
  const { brief, intent } = packet.job;
  const school = packet.facts.name;
  const campus = brief.campus
    ? `${brief.campus} Campus`
    : `${packet.facts.campuses[0]} Campus`;
  const date = brief.date ? formatDate(brief.date) : "";
  const grades = brief.grades?.length ? `Grades ${brief.grades.join("–")}` : "";
  const notes = "";
  const handle = packet.facts.socials.instagram ?? "";

  const enCore = (() => {
    if (intent === "event") {
      return `${brief.eventName || brief.eventType} is on ${date}${
        brief.time ? ` at ${formatTime(brief.time)}` : ""
      } at ${campus}.${grades ? ` ${grades} will participate.` : ""}${
        brief.parentAction === "I'll tell you" && brief.parentActionNote
          ? ` ${brief.parentActionNote}.`
          : brief.parentAction === "Register"
            ? " Please register with the school office."
            : brief.parentAction === "Bring students in sports kit"
              ? " Students should come in sports kit."
              : ""
      }${notes}`;
    }
    if (intent === "announcement") {
      return `${brief.announcementType} for ${brief.audience || "all parents"}${
        date ? ` — ${date}` : ""
      }. ${brief.bodyFacts || ""}${notes}`.trim();
    }
    if (intent === "achievement") {
      const who = namedPerson(brief) || "Our students";
      return `${who} — ${brief.achievement || "a proud Cedar moment"}${
        brief.context ? `, ${brief.context}` : ""
      }.${notes}`;
    }
    if (intent === "admissions") {
      if (packet.job.beat === "trust") {
        return `Why parents choose ${school}: ${packet.facts.mission} ${packet.facts.tagline}${notes}`;
      }
      if (packet.job.beat === "conversion") {
        return `${school} admissions. ${packet.facts.admissionsLine} Call ${packet.facts.phone} or visit ${packet.facts.website}.${notes}`;
      }
      return `${school} — admissions are open${
        brief.program && brief.program !== "All" ? ` for ${brief.program}` : ""
      }.${brief.deadline ? ` Deadline: ${formatDate(brief.deadline)}.` : ""} ${packet.facts.admissionsLine}${notes}`;
    }
    if (intent === "showcase") {
      return `A look at ${brief.showcaseType || "life"} at ${school}, ${campus}.${notes}`;
    }
    if (intent === "photos_to_post") {
      return `Moments from ${campus}.${notes}`;
    }
    return `${brief.otherCategory || "A note"} from ${school}.${notes}`;
  })();

  const closing = packet.tone.noSlang
    ? "We look forward to seeing our community together."
    : "See you there!";

  const ig = `${enCore}\n\n${closing}\n\n${handle}`.trim();
  const fb =
    `${enCore}\n\n${date ? `When: ${date}${brief.time ? `, ${brief.time}` : ""}\n` : ""}${
      campus ? `Where: ${campus}\n` : ""
    }${grades ? `Who: ${grades}\n` : ""}\n${school}\n${packet.facts.phone}\n${packet.facts.website}`.trim();
  const waEn = `${school} — ${campus}\n${enCore}\n${packet.facts.phone}`.trim();
  const li = `${enCore}\n\n${packet.facts.mission}\n\n${school} | ${packet.facts.levels}`.trim();

  const captions: Partial<Record<Channel, CaptionSet>> = {};
  const channels = packet.job.channels.length
    ? packet.job.channels
    : DEFAULT_CHANNELS[intent];

  for (const ch of channels) {
    if (ch === "ig_post" || ch === "ig_story") captions[ch] = { en: ig };
    else if (ch === "facebook") captions[ch] = { en: fb };
    else if (ch === "whatsapp") captions[ch] = { en: waEn };
    else if (ch === "linkedin") captions[ch] = { en: li };
    else captions[ch] = { en: fb };
  }
  return captions;
}

export function jobTitle(intent: Intent, brief: Brief) {
  return (
    brief.eventName ||
    brief.announcementType ||
    brief.achievement ||
    brief.showcaseType ||
    brief.otherCategory ||
    (intent === "photos_to_post"
      ? "Photo post"
      : intent === "admissions"
        ? "Admissions"
        : "School post")
  );
}

export function suggestedBeats(intent: Intent, useCampaign?: boolean) {
  if (intent === "admissions" && useCampaign) return ADMISSIONS_BEATS;
  if (intent === "event") return EVENT_BEATS;
  return [];
}

export function mixSuggestion(recent: Intent[]) {
  const lastFour = recent.slice(0, 4);
  const promo = lastFour.filter((i) => i === "admissions" || i === "event").length;
  if (promo >= 3) {
    return "You’ve had several promotional posts recently. An achievement or student-life post would balance the week.";
  }
  return undefined;
}

export function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function folderNameFor(
  brief: Brief,
  year = new Date().getFullYear().toString()
) {
  const type =
    brief.eventType || brief.announcementType || brief.showcaseType || "General";
  const campus = brief.campus || "Campus";
  const name = brief.eventName || type;
  return `${name} ${year} – ${campus}`;
}
