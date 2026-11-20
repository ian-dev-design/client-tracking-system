// Read transcripts in any format into plain text. Originals are never modified.

import path from "node:path";
import { driveClient } from "@/lib/google";

export function stripCaptions(text: string): string {
  // .vtt / .srt: drop the header, cue numbers, timestamps and NOTE lines.
  return text
    .replace(/^﻿?WEBVTT.*$/m, "")
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (/^\d+$/.test(l)) return false;
      if (/-->/.test(l)) return false;
      if (/^NOTE\b/.test(l)) return false;
      return true;
    })
    .join("\n");
}

export async function extractText(fileName: string, data: Buffer): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".vtt" || ext === ".srt") return stripCaptions(data.toString("utf8"));
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: data })).value;
  }
  if (ext === ".pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await pdfText(pdf, { mergePages: true });
    return text;
  }
  return data.toString("utf8"); // .txt, .md, pasted text
}

export function mimeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return ({
    ".txt": "text/plain", ".md": "text/markdown", ".vtt": "text/vtt", ".srt": "application/x-subrip",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  } as Record<string, string>)[ext] || "application/octet-stream";
}

export const googleDocId = (url: string) => url.match(/\/document\/d\/([\w-]+)/)?.[1] || null;

/** Read a Google Doc as text (the doc must be shared with the service account or be in the Shared Drive). */
export async function readGoogleDoc(url: string): Promise<{ text: string; name: string }> {
  const id = googleDocId(url);
  if (!id) throw new Error("That doesn't look like a Google Doc link");
  const drive = driveClient();
  const meta = await drive.files.get({ fileId: id, fields: "name", supportsAllDrives: true });
  const res = await drive.files.export({ fileId: id, mimeType: "text/plain" }, { responseType: "text" });
  return { text: String(res.data), name: meta.data.name || "Google Doc" };
}

/** File name convention: contactname_YYYY-MM-DD.ext */
export function transcriptFileName(contactName: string, date: string, ext: string): string {
  const slug = contactName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "contact";
  return `${slug}_${date}${ext}`;
}
