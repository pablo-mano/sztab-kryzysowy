import { query } from "@/lib/snowflake";

export async function GET() {
  try {
    const rows = await query("SELECT 1 AS ok");
    return Response.json({ status: "connected", rows });
  } catch (error) {
    return Response.json({
      status: "error",
      error: (error as Error).message,
    });
  }
}
