import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { dataBackend } from "@/lib/config";
import { DEMO_TRANSCRIPTS_DIR } from "@/lib/data/demo";

// Demo mode only: serve locally saved transcripts (in real mode they live in Google Drive).
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (dataBackend() !== "demo" || !(await currentUser())) return new NextResponse("Not found", { status: 404 });
  const name = path.basename(decodeURIComponent((await params).name));
  const file = path.join(DEMO_TRANSCRIPTS_DIR, name);
  if (!fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(fs.readFileSync(file), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `inline; filename="${name}"` },
  });
}
