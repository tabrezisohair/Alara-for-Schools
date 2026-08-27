export type Intent =
  | "event"
  | "announcement"
  | "achievement"
  | "admissions"
  | "showcase"
  | "photos_to_post"
  | "other";

export type JobStatus =
  | "draft"
  | "review"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "needs_edits";

export type PhotoFlag = "marketing" | "internal" | "do_not_use";

export type Channel =
  | "ig_post"
  | "ig_story"
  | "facebook"
  | "whatsapp"
  | "linkedin"
  | "gbp"
  | "website"
  | "download";

export type Provenance = "typed" | "dropdown" | "voice" | "excel" | "inferred";

export type CampaignBeat =
  | "awareness"
  | "trust"
  | "consideration"
  | "proof"
  | "conversion"
  | "announce"
  | "remind"
  | "recap";

export type FieldProvenance = Record<string, Provenance>;

export type CaptionSet = {
  en: string;
  ur?: string;
  hashtags?: string[];
};

export type JobOutput = {
  format: "square" | "story" | "wide";
  channel: Channel;
  imageUrl: string;
};

export type Brief = {
  eventType?: string;
  eventName?: string;
  campus?: string;
  date?: string;
  time?: string;
  grades?: string[];
  parentAction?: string;
  parentActionNote?: string;
  announcementType?: string;
  audience?: string;
  severity?: string;
  bodyFacts?: string;
  endDate?: string;
  who?: string;
  showName?: boolean;
  personName?: string;
  achievement?: string;
  context?: string;
  admissionsGoal?: string;
  program?: string;
  deadline?: string;
  cta?: string;
  useCampaign?: boolean;
  showcaseType?: string;
  otherCategory?: string;
  photoMode?: "finish" | "post";
  photoTreatment?: "as_is" | "captioned" | "designed";
  photoIds?: string[];
  scheduledFor?: string;
  extraNotes?: string;
};

/** Lets the approver decide from a phone without an Alara login. */
export type ApprovalLink = {
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export type ContentJob = {
  id: string;
  title: string;
  intent: Intent;
  brief: Brief;
  provenance: FieldProvenance;
  assets: string[];
  libraryFolderId?: string;
  campaignId?: string;
  campaignBeat?: CampaignBeat;
  channels: Channel[];
  captionLanguage: "en" | "ur" | "both";
  posterLanguage: "en" | "ur";
  captions: Partial<Record<Channel, CaptionSet>>;
  captionsOrigin?: "coded" | "human" | "gemini";
  outputs: JobOutput[];
  status: JobStatus;
  contentHash?: string;
  approval?: { by: string; at: string };
  approvalLink?: ApprovalLink;
  changeRequest?: { note: string; by: string; at: string };
  scheduledFor?: string;
  publishedAt?: string;
  publishedChannels?: Channel[];
  liveUrls?: Partial<Record<Channel, string>>;
  clashWarning?: string;
  templateId?: string;
  brainPacketId?: string;
  createdAt: string;
  updatedAt: string;
};

export type BrandProfile = {
  logoUrl?: string;
  logoAccepted: boolean;
  primary: string;
  secondary: string;
  accent: string;
  textOnPrimary: string;
  fonts: { heading: string; body: string };
  detectedNote?: string;
  palette: string[];
};

export type SchoolFacts = {
  name: string;
  levels: string;
  campuses: string[];
  tagline: string;
  mission: string;
  phone: string;
  website: string;
  address: string;
  admissionsLine: string;
  socials: { instagram?: string; facebook?: string; linkedin?: string };
};

export type ToneRules = {
  chips: string[];
  studentNamesDefaultOff: boolean;
  noSlang: boolean;
};

export type Vocab = {
  campuses: string[];
  eventTypes: string[];
  extraSpellings: Record<string, string>;
};

export type Asset = {
  id: string;
  folderId: string;
  url: string;
  name: string;
  flag: PhotoFlag;
  enhanced: boolean;
  keepOriginal?: boolean;
  createdAt: string;
};

export type LibraryFolder = {
  id: string;
  parentId?: string;
  name: string;
  kind: "event_type" | "event" | "general";
  campus?: string;
  year?: string;
  eventType?: string;
};

export type CalendarEvent = {
  id: string;
  name: string;
  type: string;
  date: string;
  endDate?: string;
  campus: string;
  grades?: string;
  notes?: string;
  folderId?: string;
  source: "excel" | "job" | "manual";
  approved: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  goal: string;
  beats: { beat: CampaignBeat; label: string; jobId?: string }[];
  createdAt: string;
};

export type EmailSettings = {
  enabled: boolean;
  provider: "google" | "microsoft" | null;
  connected: boolean;
  fromName: string;
  headEmail: string;
  approverEmail: string;
  notifyLive: boolean;
  notifyApproval: boolean;
  notifyFailed: boolean;
  notifyScheduledToday: boolean;
  fromEmail?: string;
};

export type EmailNotification = {
  id: string;
  type: "live" | "approval" | "failed" | "scheduled" | "test";
  to: string;
  subject: string;
  body: string;
  imageUrl?: string;
  sentAt: string;
  status: "queued" | "sent" | "failed";
  error?: string;
  jobId?: string;
};

export type UserSettings = {
  creatorName: string;
  approverName: string;
  instagramConnected: boolean;
  facebookConnected: boolean;
};

export type BrainPacket = {
  id: string;
  createdAt: string;
  brand: BrandProfile;
  facts: SchoolFacts;
  tone: ToneRules;
  job: {
    intent: Intent;
    brief: Brief;
    beat?: CampaignBeat;
    channels: Channel[];
    captionLanguage: "en" | "ur" | "both";
    posterLanguage: "en" | "ur";
  };
  assets: { id: string; url: string; flag: PhotoFlag }[];
  nearbyCalendar: CalendarEvent[];
  recentMix: Intent[];
  templateId: string;
  clashWarning?: string;
};

export type Database = {
  brand: BrandProfile;
  school: SchoolFacts;
  tone: ToneRules;
  vocab: Vocab;
  captionLanguageDefault: "en" | "ur" | "both";
  posterLanguageDefault: "en" | "ur";
  whatsappBilingual: boolean;
  jobs: ContentJob[];
  folders: LibraryFolder[];
  assets: Asset[];
  calendar: CalendarEvent[];
  campaigns: Campaign[];
  packets: BrainPacket[];
  email: EmailSettings;
  notifications: EmailNotification[];
  users: UserSettings;
};
