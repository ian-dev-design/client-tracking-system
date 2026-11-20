import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { syncSurveys } from "@/lib/surveys";

// Called by the "Sync now" button, the 5-minute auto-poll in the app, and (after
// deploying) the Apps Script form-submit ping, which authenticates with SURVEY_SYNC_SECRET.
export async function POST(req: Request) {
  const secret = process.env.SURVEY_SYNC_SECRET;
  const fromScript = secret && req.headers.get("x-sync-secret") === secret;
  const user = fromScript ? { name: "form-sync" } : await currentUser();
  if (!user) return NextResponse.json({ error: "You don't have access." }, { status: 401 });
  try {
    return NextResponse.json(await syncSurveys(user.name));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
