import { google } from "googleapis";

// Service-account clients. The key comes ONLY from the GOOGLE_SERVICE_ACCOUNT_JSON env var.
let auth: InstanceType<typeof google.auth.JWT> | null = null;

function serviceAuth() {
  if (auth) return auth;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set (see .env.example).");
  const key = JSON.parse(json);
  auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  return auth;
}

export const sheetsClient = () => google.sheets({ version: "v4", auth: serviceAuth() });
export const driveClient = () => google.drive({ version: "v3", auth: serviceAuth() });
