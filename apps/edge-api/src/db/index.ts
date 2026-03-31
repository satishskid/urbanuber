import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

let _db: LibSQLDatabase<typeof schema> | null = null;

export function getDb(
  url: string,
  authToken: string,
): LibSQLDatabase<typeof schema> {
  if (_db) return _db;

  const client = createClient({
    url,
    authToken,
  });

  _db = drizzle(client, { schema });
  return _db;
}

export function resetDb(): void {
  _db = null;
}

export { schema };
export * from "./schema";
