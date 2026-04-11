import snowflake from "snowflake-sdk";

let connection: snowflake.Connection | null = null;
let connecting: Promise<snowflake.Connection> | null = null;

function isConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER && process.env.SNOWFLAKE_PASSWORD);
}

function getConnection(): Promise<snowflake.Connection> {
  if (!isConfigured()) {
    return Promise.reject(new Error("Snowflake not configured — using fallback data"));
  }

  if (connection) return Promise.resolve(connection);
  if (connecting) return connecting;

  connecting = new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USER!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "SZTAB_WH",
      database: process.env.SNOWFLAKE_DATABASE || "SZTAB_DB",
      schema: process.env.SNOWFLAKE_SCHEMA || "PUBLIC",
    });

    conn.connect((err) => {
      if (err) {
        connecting = null;
        reject(err);
      } else {
        connection = conn;
        connecting = null;
        resolve(conn);
      }
    });
  });

  return connecting;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: snowflake.Binds = [],
): Promise<T[]> {
  const conn = await getConnection();

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      },
    });
  });
}
