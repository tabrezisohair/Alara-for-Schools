import type { BrandProfile, SchoolFacts, ToneRules, Vocab } from "@/lib/types";

export type WorkspacePayload = {
  organization: {
    id: string;
    name: string;
    industry: string;
    slug: string;
    timezone: string;
  };
  membership: {
    userId: string;
    email?: string;
    organizationId: string;
    roles: string[];
  };
  roles: string[];
  school_profile: SchoolFacts;
  brand_profile: BrandProfile;
  school: SchoolFacts;
  brand: BrandProfile;
  tone: ToneRules;
  vocab: Vocab;
  captionLanguageDefault: "en" | "ur" | "both";
  posterLanguageDefault: "en" | "ur";
  whatsappBilingual: boolean;
};

type OrgRow = {
  id: string;
  name: string;
  industry: string;
  slug: string;
  timezone: string;
};

type SchoolRow = {
  levels: string | null;
  campuses: string[] | null;
  tagline: string | null;
  mission: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  admissions_line: string | null;
  socials: Record<string, string> | null;
  tone: Partial<ToneRules> | null;
  event_types: string[] | null;
  extra_spellings: Record<string, string> | null;
  caption_language_default: string;
  poster_language_default: string;
  whatsapp_bilingual: boolean;
};

type BrandRow = {
  logo_path: string | null;
  logo_accepted: boolean;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_on_primary: string;
  heading_font: string;
  body_font: string;
  detected_note: string | null;
  palette?: string[] | null;
};

export function mapWorkspace(
  org: OrgRow,
  school: SchoolRow | null,
  brand: BrandRow | null,
  membership: {
    userId: string;
    email?: string;
    organizationId: string;
    roles: string[];
  },
  logoUrl?: string
): WorkspacePayload {
  const tone: ToneRules = {
    chips: school?.tone?.chips ?? [],
    studentNamesDefaultOff: school?.tone?.studentNamesDefaultOff ?? true,
    noSlang: school?.tone?.noSlang ?? true,
  };
  const campuses = school?.campuses ?? [];
  const schoolFacts: SchoolFacts = {
    name: org.name,
    levels: school?.levels ?? "",
    campuses,
    tagline: school?.tagline ?? "",
    mission: school?.mission ?? "",
    phone: school?.phone ?? "",
    website: school?.website ?? "",
    address: school?.address ?? "",
    admissionsLine: school?.admissions_line ?? "",
    socials: {
      instagram: school?.socials?.instagram,
      facebook: school?.socials?.facebook,
      linkedin: school?.socials?.linkedin,
    },
  };
  const brandProfile: BrandProfile = {
    logoUrl,
    logoAccepted: brand?.logo_accepted ?? false,
    primary: brand?.primary_color ?? "#0D2C54",
    secondary: brand?.secondary_color ?? "#E8B923",
    accent: brand?.accent_color ?? "#F7F1DE",
    textOnPrimary: brand?.text_on_primary ?? "#FFFFFF",
    fonts: {
      heading: brand?.heading_font ?? "Georgia, serif",
      body: brand?.body_font ?? "system-ui, sans-serif",
    },
    detectedNote: brand?.detected_note ?? undefined,
    palette:
      brand?.palette && brand.palette.length
        ? brand.palette
        : [
            brand?.primary_color ?? "#0D2C54",
            brand?.secondary_color ?? "#E8B923",
            brand?.accent_color ?? "#F7F1DE",
          ],
  };
  return {
    organization: {
      id: org.id,
      name: org.name,
      industry: org.industry,
      slug: org.slug,
      timezone: org.timezone,
    },
    membership,
    roles: membership.roles,
    school_profile: schoolFacts,
    brand_profile: brandProfile,
    school: schoolFacts,
    brand: brandProfile,
    tone,
    vocab: {
      campuses,
      eventTypes: school?.event_types ?? [],
      extraSpellings: school?.extra_spellings ?? {},
    },
    captionLanguageDefault: (school?.caption_language_default ?? "en") as
      | "en"
      | "ur"
      | "both",
    posterLanguageDefault: (school?.poster_language_default ?? "en") as
      | "en"
      | "ur",
    whatsappBilingual: school?.whatsapp_bilingual ?? false,
  };
}
