import type { Row, TableName } from "./schema";

/**
 * Everything the app needs from storage. Implement this for a new backend
 * (e.g. Supabase) and switch DATA_BACKEND — no UI changes needed.
 */
export interface Store {
  /** All rows of a table. Rows typed into the Sheet with a blank id/created_at get them filled in. */
  list(table: TableName): Promise<Row[]>;
  insert(table: TableName, row: Row): Promise<Row>;
  update(table: TableName, id: string, patch: Row): Promise<Row>;
  /** Raw Google Form responses (read-only). `key` uniquely identifies a response. */
  listRawSurveyResponses(): Promise<RawSurveyResponse[]>;
}

export interface RawSurveyResponse {
  key: string;
  timestamp: string;
  email: string;
  answers: { question: string; answer: string }[];
}
