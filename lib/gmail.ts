// Send an email from the signed-in teammate's own Gmail, using the token they
// granted at sign-in (gmail.send scope). Only called from POST /api/outreach/send,
// which only runs when someone clicks "Approve & send".

import { google } from "googleapis";

function encodeHeader(value: string) {
  // RFC 2047 so non-ASCII subjects survive.
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

export async function sendGmail(opts: { accessToken: string; from: string; to: string; subject: string; body: string }) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: opts.accessToken });
  const gmail = google.gmail({ version: "v1", auth });
  const message = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    opts.body,
  ].join("\r\n");
  const raw = Buffer.from(message).toString("base64url");
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return res.data.id;
}
