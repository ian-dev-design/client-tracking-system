// Who is acting right now, for code deep inside lib/ that needs it (notification emails pick
// their sender from this). API routes run inside withUser (lib/api.ts), which sets it; scheduled
// jobs set { system: true }. The CLI sets nothing.

import { AsyncLocalStorage } from "node:async_hooks";
import type { User } from "@/lib/auth";

export type RequestContext = { user?: User; req?: Request; system?: boolean };

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(ctx: RequestContext, fn: () => Promise<T>) => storage.run(ctx, fn);
export const currentContext = (): RequestContext => storage.getStore() || {};
