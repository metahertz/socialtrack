import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Health check endpoint. Verifies MongoDB connectivity.
 * Returns 503 if database is unavailable so the app can show a helpful error.
 */
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Database is not configured. Add MONGODB_URI to your .env file. See .env.example for the template.",
        },
        { status: 503 }
      );
    }

    const db = await getDb();
    await db.command({ ping: 1 });

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to connect to database";
    return NextResponse.json(
      {
        status: "error",
        message:
          "Cannot connect to the database. Please check that MONGODB_URI in your .env file is correct and that your MongoDB Atlas cluster is reachable.",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 503 }
    );
  }
}
