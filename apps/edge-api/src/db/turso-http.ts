/**
 * Turso HTTP client for Cloudflare Workers
 * Uses Turso's HTTP API directly — no Node.js dependencies needed
 */

interface TursoConfig {
  url: string;
  authToken: string;
}

interface QueryResult {
  rows: any[];
  columns: string[];
}

function toTursoValue(v: any): any {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "string") return { type: "text", value: v };
  if (typeof v === "number") return { type: "real", value: v };
  if (typeof v === "boolean") return { type: "integer", value: v ? 1 : 0 };
  return { type: "text", value: String(v) };
}

function fromTursoValue(cell: any): any {
  if (!cell || typeof cell !== "object") return cell;
  if ("value" in cell) return cell.value;
  return cell;
}

async function tursoPipeline(
  config: TursoConfig,
  requests: any[],
): Promise<any[]> {
  const baseUrl = config.url.replace("libsql://", "https://");
  const response = await fetch(`${baseUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.authToken}`,
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turso HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.results?.map((r: any) => r.response) || [];
}

async function tursoExecute(
  config: TursoConfig,
  sql: string,
  args: any[] = [],
): Promise<QueryResult> {
  const typedArgs = args.map(toTursoValue);
  const results = await tursoPipeline(config, [
    {
      type: "execute",
      stmt: { sql, args: typedArgs },
    },
  ]);

  const result = results[0]?.result;
  if (!result) return { rows: [], columns: [] };

  // Turso HTTP API returns cols as array of {name: string} or just strings
  const cols = (result.cols || []).map((c: any) =>
    typeof c === "object" ? c.name : String(c),
  );

  return {
    columns: cols,
    rows: (result.rows || []).map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((col: string, i: number) => {
        obj[col] = fromTursoValue(row[i]);
      });
      return obj;
    }),
  };
}

export { tursoExecute, tursoPipeline };
export type { TursoConfig, QueryResult };
