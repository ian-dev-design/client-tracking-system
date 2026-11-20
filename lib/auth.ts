import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { normEmail } from "@/lib/util";

// Google sign-in + allowlist. Signing in also grants permission to send email
// from the teammate's own Gmail (gmail.send scope) — approved once at sign-in.

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "").split(",").map(normEmail).filter(Boolean);
}
export const isAllowed = (email?: string | null) => !!email && allowedEmails().includes(normEmail(email));

/** Demo mode: no Google sign-in configured, local only, demo data. Never active on Vercel. */
export const demoAuth = () =>
  !process.env.GOOGLE_CLIENT_ID && process.env.DATA_BACKEND !== "sheets" && !process.env.VERCEL;

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token", refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error("Could not refresh Google token");
  return (await res.json()) as { access_token: string; expires_in: number };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: { signIn: "/sign-in", error: "/no-access" },
  callbacks: {
    async signIn({ user }) {
      return isAllowed(user.email) ? true : "/no-access";
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }
      const expiresAt = (token.expiresAt as number | undefined) ?? 0;
      if (Date.now() / 1000 < expiresAt - 60 || !token.refreshToken) return token;
      try {
        const fresh = await refreshAccessToken(token.refreshToken as string);
        token.accessToken = fresh.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + fresh.expires_in;
      } catch {
        token.accessToken = undefined;
      }
      return token;
    },
    // The Gmail token stays inside the encrypted server-side JWT; it is never sent to the browser.
    async session({ session }) {
      return session;
    },
  },
};

/**
 * A working Gmail access token for this request. Google tokens expire after an hour, and the
 * refreshed one isn't always saved back to the sign-in cookie, so refresh here when it's stale.
 */
export async function gmailAccessToken(token: Record<string, unknown> | null) {
  if (!token) return undefined;
  const expiresAt = Number(token.expiresAt) || 0;
  if (token.accessToken && Date.now() / 1000 < expiresAt - 60) return token.accessToken as string;
  if (!token.refreshToken) return undefined;
  try {
    return (await refreshAccessToken(token.refreshToken as string)).access_token;
  } catch {
    return undefined;
  }
}

export type User = { name: string; email: string; demo: boolean };

/** The signed-in, allowlisted user — or null. */
export async function currentUser(): Promise<User | null> {
  if (demoAuth()) {
    return { name: process.env.DEMO_USER_NAME || "Demo", email: process.env.DEMO_USER_EMAIL || "", demo: true };
  }
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !isAllowed(email)) return null; // removed from allowlist → locked out immediately
  return { name: session.user?.name?.split(" ")[0] || email, email, demo: false };
}
