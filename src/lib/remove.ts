import { eventIdentity } from "./calendarIdentity";
import type { Asset, CalendarEvent, Campaign, ContentJob, Database, LibraryFolder } from "./types";

export function removeCalendarEvent(db: Database, id: string) {
  const event = db.calendar.find((item) => item.id === id);
  db.calendar = db.calendar.filter((item) => item.id !== id);
  return event;
}

export function removeDuplicateCalendarEvents(db: Database) {
  const seen = new Set<string>();
  const kept: CalendarEvent[] = [];
  const removed: CalendarEvent[] = [];
  for (const row of db.calendar) {
    const key = eventIdentity(row);
    if (seen.has(key)) {
      removed.push(row);
      continue;
    }
    seen.add(key);
    kept.push(row);
  }
  db.calendar = kept;
  return removed;
}

export function removeJob(db: Database, id: string) {
  const job = db.jobs.find((item) => item.id === id);
  if (!job) return null;
  db.jobs = db.jobs.filter((item) => item.id !== id);
  if (job.brainPacketId) {
    db.packets = db.packets.filter((packet) => packet.id !== job.brainPacketId);
  }
  for (const campaign of db.campaigns) {
    for (const beat of campaign.beats) {
      if (beat.jobId === id) delete beat.jobId;
    }
  }
  return job;
}

export function removeCampaign(db: Database, id: string) {
  const campaign = db.campaigns.find((item) => item.id === id);
  if (!campaign) return null;
  db.campaigns = db.campaigns.filter((item) => item.id !== id);
  for (const job of db.jobs) {
    if (job.campaignId === id) {
      delete job.campaignId;
      delete job.campaignBeat;
    }
  }
  return campaign;
}

export function removeAsset(db: Database, id: string) {
  const asset = db.assets.find((item) => item.id === id);
  db.assets = db.assets.filter((item) => item.id !== id);
  return asset ?? null;
}

export function removeEventFolder(db: Database, id: string) {
  const folder = db.folders.find((item) => item.id === id);
  if (!folder || folder.kind !== "event") {
    return { folder: null as LibraryFolder | null, assets: [] as Asset[] };
  }
  const assets = db.assets.filter((item) => item.folderId === id);
  db.assets = db.assets.filter((item) => item.folderId !== id);
  db.folders = db.folders.filter((item) => item.id !== id);
  return { folder, assets };
}

export function removeNotification(db: Database, id: string) {
  const note = db.notifications.find((item) => item.id === id);
  if (!note || note.status === "sent") return null;
  db.notifications = db.notifications.filter((item) => item.id !== id);
  return note;
}
