import type { ComponentType } from "react";
import type { Intent } from "./types";
import {
  IconCap,
  IconMegaphone,
  IconParty,
  IconPhotos,
  IconSchool,
  IconSpark,
  IconTrophy,
} from "@/components/icons";

export const INTENT_UI: Record<
  Intent,
  { tint: string; Icon: ComponentType<{ className?: string }> }
> = {
  event: { tint: "bg-amber-100 text-amber-600", Icon: IconParty },
  announcement: { tint: "bg-violet-100 text-violet-600", Icon: IconMegaphone },
  achievement: { tint: "bg-emerald-100 text-emerald-600", Icon: IconTrophy },
  admissions: { tint: "bg-sky-100 text-sky-600", Icon: IconCap },
  showcase: { tint: "bg-pink-100 text-pink-600", Icon: IconSchool },
  photos_to_post: { tint: "bg-teal-100 text-teal-600", Icon: IconPhotos },
  other: { tint: "bg-orange-100 text-orange-600", Icon: IconSpark },
};
