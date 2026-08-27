import { promises as fs } from "fs";
import path from "path";
import type { EmailNotification } from "../types";
import { validAccessToken } from "./oauth";
import type { MailTokens } from "./tokens";

type Attachment = { name: string; mime: string; base64: string };

export async function sendNotification(mail: EmailNotification) {
  const tokens = await validAccessToken();
  if (!tokens) {
    throw new Error("Mailbox is not connected. Connect Gmail or Outlook in Settings.");
  }
  const attachment = await loadAttachment(mail.imageUrl);
  const from = tokens.accountEmail || "Alara";
  if (tokens.provider === "google") {
    await sendGmail(tokens, mail, from, attachment);
    return;
  }
  await sendGraph(tokens, mail, attachment);
}

async function sendGmail(
  tokens: MailTokens,
  mail: EmailNotification,
  from: string,
  attachment?: Attachment
) {
  const raw = buildMime({
    from: `Alara <${from}>`,
    to: mail.to,
    subject: mail.subject,
    body: mail.body,
    attachment,
  });
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err.slice(0, 280) || "Gmail send failed");
  }
}

async function sendGraph(
  tokens: MailTokens,
  mail: EmailNotification,
  attachment?: Attachment
) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: mail.subject,
        body: { contentType: "Text", content: mail.body },
        toRecipients: [{ emailAddress: { address: mail.to } }],
        attachments: attachment
          ? [
              {
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: attachment.name,
                contentType: attachment.mime,
                contentBytes: attachment.base64,
              },
            ]
          : [],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err.slice(0, 280) || "Outlook send failed");
  }
}

function buildMime({
  from,
  to,
  subject,
  body,
  attachment,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachment?: Attachment;
}) {
  const boundary = `alara_${crypto.randomUUID()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${rfc2047(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap64(Buffer.from(body, "utf8").toString("base64")),
  ];
  if (attachment) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mime}; name="${attachment.name}"`,
      `Content-Disposition: attachment; filename="${attachment.name}"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrap64(attachment.base64)
    );
  }
  lines.push(`--${boundary}--`);
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

function rfc2047(text: string) {
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function wrap64(value: string) {
  return value.replace(/.{1,76}/g, (line) => `${line}\n`).trim();
}

async function loadAttachment(imageUrl?: string): Promise<Attachment | undefined> {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return undefined;
    const ext = match[1].includes("jpeg") ? "jpg" : match[1].includes("png") ? "png" : "webp";
    return { name: `post.${ext}`, mime: match[1], base64: match[2] };
  }
  if (imageUrl.startsWith("/")) {
    const file = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
    try {
      const buf = await fs.readFile(file);
      const ext = path.extname(file).slice(1).toLowerCase() || "png";
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : ext === "svg"
              ? "image/svg+xml"
              : "image/png";
      return {
        name: `post.${ext === "jpeg" ? "jpg" : ext}`,
        mime,
        base64: buf.toString("base64"),
      };
    } catch {
      return undefined;
    }
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return undefined;
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      return { name: `post.${ext}`, mime, base64: buf.toString("base64") };
    } catch {
      return undefined;
    }
  }
  return undefined;
}
