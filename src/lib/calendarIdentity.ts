export function eventIdentity(event: {
  name: string;
  date: string;
  campus: string;
}) {
  return [event.name, event.date, event.campus]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}
