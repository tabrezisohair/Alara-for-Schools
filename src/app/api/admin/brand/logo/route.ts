import { requireSchoolAdmin } from "@/lib/auth/membership";
import { extractPaletteFromImage, rolesFromPalette } from "@/lib/brandColors";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const resolved = await requireSchoolAdmin();
  if ("error" in resolved) return resolved.error;
  const { membership } = resolved;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a logo file." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${membership.organizationId}/branding/logo.${ext || "png"}`;
  const supabase = await createServerSupabase();
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("organization-files")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: true });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 400 });
  }

  const extracted = extractPaletteFromImage(bytes, file.type || "");
  const { data: current } = await supabase
    .from("brand_profiles")
    .select("palette, primary_color, secondary_color, accent_color")
    .eq("organization_id", membership.organizationId)
    .maybeSingle();

  const palette =
    extracted.length > 0
      ? extracted
      : current?.palette?.length
        ? current.palette
        : [
            current?.primary_color ?? "#0D2C54",
            current?.secondary_color ?? "#E8B923",
            current?.accent_color ?? "#F7F1DE",
          ];
  const roles = rolesFromPalette(palette);
  const note =
    extracted.length > 0
      ? `Colours taken from the uploaded logo (${extracted.length} swatch${
          extracted.length === 1 ? "" : "es"
        }). You can add or change them anytime.`
      : undefined;

  const { error } = await supabase
    .from("brand_profiles")
    .update({
      logo_path: path,
      logo_accepted: true,
      palette,
      primary_color: roles.primary,
      secondary_color: roles.secondary,
      accent_color: roles.accent,
      text_on_primary: roles.textOnPrimary,
      ...(note ? { detected_note: note } : {}),
    })
    .eq("organization_id", membership.organizationId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({
    ok: true,
    path,
    palette,
    extracted: extracted.length > 0,
  });
}
