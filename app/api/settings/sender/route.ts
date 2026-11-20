import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { withUser } from "@/lib/api";

// Shows YOUR OWN Gmail sign-in permission (refresh token) once, so you can paste it into .env.local
// as NOTIFY_SENDER_REFRESH_TOKEN to make your account the sender for scheduled emails.
// Never stored in the Sheet or git. Only returns the token of the person asking.
export const POST = withUser(async (req, user) => {
  if (user.demo) throw new Error("Not available in demo mode.");
  const token = await getToken({ req: req as NextRequest, secret: process.env.NEXTAUTH_SECRET });
  const refreshToken = token?.refreshToken as string | undefined;
  if (!refreshToken) throw new Error("No permission found. Sign out, sign in again, then retry.");
  return { email: user.email, refreshToken };
});
