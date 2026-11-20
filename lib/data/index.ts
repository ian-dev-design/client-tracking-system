import { dataBackend } from "@/lib/config";
import type { Store } from "./types";
import { demoStore } from "./demo";
import { sheetsStore } from "./sheets";

// The one place that picks the storage backend. Add "supabase" here later.
export function store(): Store {
  switch (dataBackend()) {
    case "sheets":
      return sheetsStore;
    default:
      return demoStore;
  }
}

export * from "./schema";
export type { Store, RawSurveyResponse } from "./types";
