import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { StoredLinkedInData } from "@/lib/linkedinImport";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const doc = await db.collection("linkedin_data").findOne({
      userId: session.userId,
    });

    if (!doc) {
      return NextResponse.json({ data: null });
    }

    const { _id, userId, ...data } = doc;
    return NextResponse.json({ data: data as StoredLinkedInData });
  } catch (e) {
    console.error("LinkedIn GET error:", e);
    return NextResponse.json(
      { error: "Failed to load data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = body as StoredLinkedInData;

    if (!data?.platform || data.platform !== "linkedin" || !Array.isArray(data.posts)) {
      return NextResponse.json({ error: "Invalid LinkedIn data" }, { status: 400 });
    }

    const db = await getDb();
    const payload = {
      userId: session.userId,
      ...data,
      lastImportedAt: data.lastImportedAt ?? new Date().toISOString(),
    };

    await db.collection("linkedin_data").updateOne(
      { userId: session.userId },
      { $set: payload },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    console.error("LinkedIn POST error:", e);
    return NextResponse.json(
      { error: "Failed to save data" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    await db.collection("linkedin_data").deleteOne({ userId: session.userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("LinkedIn DELETE error:", e);
    return NextResponse.json(
      { error: "Failed to clear data" },
      { status: 500 }
    );
  }
}
