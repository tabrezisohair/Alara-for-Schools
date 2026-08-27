import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { buildTemplateBuffer } from "@/lib/excel";

export async function GET() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const buf = buildTemplateBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="alara-school-calendar.xlsx"',
    },
  });
}
