import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { newId } from "@/lib/brain";
import { updateDb } from "@/lib/store";
import type { LibraryFolder } from "@/lib/types";

export async function POST(request: Request) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const body = (await request.json()) as {
    name?: string;
    campus?: string;
    date?: string;
    eventType?: string;
  };
  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "Event name is required" }, { status: 400 });
  }

  let created: LibraryFolder | undefined;
  const db = await updateDb((current) => {
    const year =
      body.date?.slice(0, 4) || new Date().getFullYear().toString();
    const eventType = body.eventType?.trim() || name;
    let parent = current.folders.find(
      (folder) =>
        folder.kind === "event_type" &&
        folder.name.toLowerCase() === eventType.toLowerCase()
    );
    if (!parent) {
      parent = {
        id: newId("fld"),
        name: eventType,
        kind: "event_type",
        eventType,
      };
      current.folders.push(parent);
    }
    const campus = body.campus || current.school.campuses[0];
    const folderName = `${name}${campus ? ` – ${campus}` : ""}${
      year ? ` ${year}` : ""
    }`;
    const existing = current.folders.find(
      (folder) => folder.name.toLowerCase() === folderName.toLowerCase()
    );
    if (existing) {
      created = existing;
      return current;
    }
    created = {
      id: newId("fld"),
      parentId: parent.id,
      name: folderName,
      kind: "event",
      campus,
      year,
      eventType,
    };
    current.folders.push(created);
    return current;
  });

  return Response.json(created ?? db.folders.at(-1));
}
