import type { Channel, Intent } from "./types";

export const INTENTS: {
  id: Intent;
  label: string;
  hint: string;
  examples: string;
}[] = [
  {
    id: "event",
    label: "Promote an Event",
    hint: "Sports Day, Annual Day, Science Fair",
    examples: "Sports Day, Annual Day, Science Fair, Independence Day",
  },
  {
    id: "announcement",
    label: "Make an Announcement",
    hint: "Closure, exams, policy, parent meeting",
    examples: "School closure, exam schedule, new policy, parent meeting",
  },
  {
    id: "achievement",
    label: "Celebrate an Achievement",
    hint: "Winners, results, student of the month",
    examples: "Student achievement, competition winner, academic results",
  },
  {
    id: "admissions",
    label: "Admissions",
    hint: "Open, deadline, tour, program spotlight",
    examples: "Admissions open, program spotlight, campus tour, deadline",
  },
  {
    id: "showcase",
    label: "Showcase Our School",
    hint: "Teachers, facilities, student life",
    examples: "Teacher spotlight, facilities, student life, activities",
  },
  {
    id: "photos_to_post",
    label: "Turn Photos into a Post",
    hint: "Original photo, caption, or branded canvas around it",
    examples: "Upload a real photo. Alara never edits faces.",
  },
  {
    id: "other",
    label: "Create Something Else",
    hint: "Welcome, reminder, congratulations",
    examples: "Welcome, reminder, principal’s message",
  },
];

export const EVENT_TYPES = [
  "Sports Day",
  "Annual Day",
  "Science Fair",
  "Independence Day",
  "Cultural Day",
  "Teachers' Day",
  "Field Trip",
  "Debate Competition",
  "Art Exhibition",
  "Other",
] as const;

export const ANNOUNCEMENT_TYPES = [
  "School closure",
  "Exam schedule",
  "New policy",
  "Parent meeting",
  "Holiday notice",
  "Reminder",
  "Other",
] as const;

export const SHOWCASE_TYPES = [
  "Teacher spotlight",
  "Facilities",
  "Student life",
  "Activities",
] as const;

export const OTHER_CATEGORIES = [
  "Welcome",
  "Congratulations",
  "Reminder",
  "Principal's message",
  "Other",
] as const;

export const GRADE_OPTIONS = [
  "Pre-Nursery",
  "Nursery",
  "KG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "A-Level",
];

export const CHANNEL_META: {
  id: Channel;
  label: string;
  ease: number;
  format: "square" | "story" | "wide";
}[] = [
  { id: "download", label: "Download pack", ease: 1, format: "square" },
  { id: "ig_post", label: "Instagram Post", ease: 2, format: "square" },
  { id: "ig_story", label: "Instagram Story", ease: 3, format: "story" },
  { id: "facebook", label: "Facebook Post", ease: 4, format: "square" },
  { id: "whatsapp", label: "WhatsApp share card", ease: 5, format: "square" },
  { id: "linkedin", label: "LinkedIn", ease: 6, format: "wide" },
  { id: "gbp", label: "Google Business", ease: 7, format: "square" },
  { id: "website", label: "Website", ease: 8, format: "wide" },
];

export function formatsForChannels(channels: Channel[]) {
  return channels.map((channel) => ({
    channel,
    format:
      CHANNEL_META.find((item) => item.id === channel)?.format ??
      ("square" as const),
  }));
}

export const DEFAULT_CHANNELS: Record<Intent, Channel[]> = {
  event: ["ig_post", "ig_story", "facebook", "whatsapp", "download"],
  announcement: ["whatsapp", "facebook", "download"],
  achievement: ["ig_post", "facebook", "whatsapp", "download"],
  admissions: ["ig_post", "facebook", "linkedin", "whatsapp", "download"],
  showcase: ["ig_post", "ig_story", "facebook", "download"],
  photos_to_post: ["ig_post", "ig_story", "whatsapp", "download"],
  other: ["ig_post", "whatsapp", "download"],
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  review: "Awaiting approval",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  rejected: "Rejected",
  needs_edits: "Needs edits",
};

export const ADMISSIONS_BEATS = [
  { beat: "awareness" as const, label: "Admissions Open" },
  { beat: "trust" as const, label: "Why parents choose us" },
  { beat: "consideration" as const, label: "Academic programmes" },
  { beat: "proof" as const, label: "Campus experience" },
  { beat: "conversion" as const, label: "Apply / Enquire now" },
];

export const EVENT_BEATS = [
  { beat: "announce" as const, label: "Announcement" },
  { beat: "remind" as const, label: "Reminder" },
  { beat: "recap" as const, label: "Recap" },
];
