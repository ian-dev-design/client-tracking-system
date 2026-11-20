import { NextResponse } from "next/server";
import { currentUser, type User } from "@/lib/auth";

/** Wrap a route handler: rejects anyone not signed in + allowlisted, turns errors into JSON. */
export function withUser<C>(handler: (req: Request, user: User, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "You don't have access." }, { status: 401 });
    try {
      const result = await handler(req, user, ctx);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  };
}
