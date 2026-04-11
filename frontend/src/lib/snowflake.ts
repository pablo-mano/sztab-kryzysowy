import snowflake from "snowflake-sdk";
import crypto from "crypto";

// Suppress SDK logging noise
snowflake.configure({ logLevel: "ERROR" });

let connection: snowflake.Connection | null = null;
let connecting: Promise<snowflake.Connection> | null = null;

function isConfigured(): boolean {
  return !!(
    process.env.SNOWFLAKE_ACCOUNT &&
    process.env.SNOWFLAKE_USER &&
    (process.env.SNOWFLAKE_PASSWORD || process.env.SNOWFLAKE_PRIVATE_KEY || process.env.SNOWFLAKE_PRIVATE_KEY_BASE64)
  );
}

function getConnectionOptions(): snowflake.ConnectionOptions {
  const account = process.env.SNOWFLAKE_ACCOUNT!.trim();
  const host = process.env.SNOWFLAKE_HOST?.trim();
  const base: snowflake.ConnectionOptions = {
    account,
    username: process.env.SNOWFLAKE_USER!.trim(),
    warehouse: (process.env.SNOWFLAKE_WAREHOUSE || "SZTAB_WH").trim(),
    database: (process.env.SNOWFLAKE_DATABASE || "SZTAB_DB").trim(),
    schema: (process.env.SNOWFLAKE_SCHEMA || "PUBLIC").trim(),
    ...(host && {
      host,
      accessUrl: `https://${host}`,
    }),
  };

  // Key-pair auth
  const keyEnv = process.env.SNOWFLAKE_PRIVATE_KEY_BASE64 || process.env.SNOWFLAKE_PRIVATE_KEY;
  if (keyEnv) {
    let pem: string;
    if (process.env.SNOWFLAKE_PRIVATE_KEY_BASE64) {
      pem = Buffer.from(keyEnv, "base64").toString("utf-8");
    } else {
      pem = keyEnv.replace(/\\n/g, "\n").trim();
    }
    const privateKeyObject = crypto.createPrivateKey({
      key: pem,
      format: "pem",
    });
    return {
      ...base,
      authenticator: "SNOWFLAKE_JWT",
      privateKey: privateKeyObject.export({ type: "pkcs8", format: "pem" }) as string,
    };
  }

  // Password auth
  return { ...base, password: process.env.SNOWFLAKE_PASSWORD! };
}

function getConnection(): Promise<snowflake.Connection> {
  if (!isConfigured()) {
    return Promise.reject(new Error("Snowflake not configured — using fallback data"));
  }

  if (connection) return Promise.resolve(connection);
  if (connecting) return connecting;

  connecting = new Promise((resolve, reject) => {
    const conn = snowflake.createConnection(getConnectionOptions());

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
        if (err) {
          // Reset stale connection
          connection = null;
          reject(err);
        } else {
          resolve((rows || []) as T[]);
        }
      },
    });
  });
}
