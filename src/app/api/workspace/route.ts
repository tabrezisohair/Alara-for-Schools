import { getMembership, isAdmin } from "@/lib/auth/membership";
import { mapWorkspace } from "@/lib/auth/workspace";
import { rolesFromPalette, uniqueHex } from "@/lib/brandColors";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SchoolFacts, ToneRules } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await getMembership();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const supabase = await createServerSupabase();

  const [{ data: org, error: orgError }, { data: school }, { data: brand }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, industry, slug, timezone")
        .eq("id", membership.organizationId)
        .single(),
      supabase
        .from("school_profiles")
        .select("*")
        .eq("organization_id", membership.organizationId)
        .maybeSingle(),
      supabase
        .from("brand_profiles")
        .select("*")
        .eq("organization_id", membership.organizationId)
        .maybeSingle(),
    ]);

  if (orgError || !org) {
    return Response.json(
      { error: orgError?.message || "Organization not found" },
      { status: 404 }
    );
  }

  let logoUrl: string | undefined;
  if (brand?.logo_path) {
    const signed = await supabase.storage
      .from("organization-files")
      .createSignedUrl(brand.logo_path, 60 * 60);
    logoUrl = signed.data?.signedUrl;
  }

  return Response.json(
    mapWorkspace(
      org,
      school,
      brand,
      {
        userId: membership.userId,
        email: membership.email,
        organizationId: membership.organizationId,
        roles: membership.roles,
      },
      logoUrl
    )
  );
}

export async function PATCH(request: Request) {
  const resolved = await getMembership();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  if (!isAdmin(membership.roles)) {
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = (await request.json()) as {
    school?: Partial<SchoolFacts> & { name?: string };
    brand?: Partial<{
      logoAccepted: boolean;
      primary: string;
      secondary: string;
      accent: string;
      textOnPrimary: string;
      fonts: { heading?: string; body?: string };
      detectedNote: string;
      palette: string[];
    }>;
    tone?: Partial<ToneRules>;
    captionLanguageDefault?: "en" | "ur" | "both";
    posterLanguageDefault?: "en" | "ur";
    whatsappBilingual?: boolean;
  };

  const supabase = await createServerSupabase();

  if (body.school?.name) {
    const { error } = await supabase
      .from("organizations")
      .update({ name: body.school.name })
      .eq("id", membership.organizationId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  if (body.school) {
    const school = body.school;
    const { error } = await supabase
      .from("school_profiles")
      .update(
        defined({
          levels: school.levels,
          tagline: school.tagline,
          mission: school.mission,
          phone: school.phone,
          website: school.website,
          address: school.address,
          admissions_line: school.admissionsLine,
          campuses: school.campuses,
          socials: school.socials,
        })
      )
      .eq("organization_id", membership.organizationId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  if (
    body.tone ||
    body.captionLanguageDefault ||
    body.posterLanguageDefault ||
    body.whatsappBilingual !== undefined
  ) {
    const { data: current } = await supabase
      .from("school_profiles")
      .select("tone")
      .eq("organization_id", membership.organizationId)
      .single();
    const { error } = await supabase
      .from("school_profiles")
      .update(
        defined({
          tone: body.tone ? { ...(current?.tone ?? {}), ...body.tone } : undefined,
          caption_language_default: body.captionLanguageDefault,
          poster_language_default: body.posterLanguageDefault,
          whatsapp_bilingual: body.whatsappBilingual,
        })
      )
      .eq("organization_id", membership.organizationId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  if (body.brand) {
    const brand = body.brand;
    const palette = brand.palette ? uniqueHex(brand.palette) : undefined;
    const roles = palette ? rolesFromPalette(palette) : null;
    const { error } = await supabase
      .from("brand_profiles")
      .update(
        defined({
          logo_accepted: brand.logoAccepted,
          palette,
          primary_color: palette ? roles?.primary : brand.primary,
          secondary_color: palette ? roles?.secondary : brand.secondary,
          accent_color: palette ? roles?.accent : brand.accent,
          text_on_primary: brand.textOnPrimary ?? roles?.textOnPrimary,
          heading_font: brand.fonts?.heading,
          body_font: brand.fonts?.body,
          detected_note: brand.detectedNote,
        })
      )
      .eq("organization_id", membership.organizationId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  return GET();
}

function defined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}
