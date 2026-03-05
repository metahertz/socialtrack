import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomBytes } from "crypto";

export interface PublicProfileSettings {
  enabled: boolean;
  slug: string;
  dateFrom: string;
  dateTo: string;
}

const SLUG_REGEX = /^[a-z0-9_-]{4,32}$/;

function generateSlug(): string {
  return randomBytes(6).toString("base64url").toLowerCase().slice(0, 12);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const doc = await db.collection("users").findOne(
      { _id: new ObjectId(session.userId) },
      { projection: { publicProfile: 1 } }
    );

    const profile = doc?.publicProfile as PublicProfileSettings | undefined;
    const settings: PublicProfileSettings = profile
      ? {
          enabled: !!profile.enabled,
          slug: profile.slug ?? generateSlug(),
          dateFrom: profile.dateFrom ?? "",
          dateTo: profile.dateTo ?? "",
        }
      : {
          enabled: false,
          slug: generateSlug(),
          dateFrom: "",
          dateTo: "",
        };

    return NextResponse.json({ settings });
  } catch (e) {
    console.error("Profile GET error:", e);
    return NextResponse.json(
      { error: "Failed to load settings" },
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
    const { enabled, slug, dateFrom, dateTo } = body as Partial<PublicProfileSettings>;

    const db = await getDb();
    const users = db.collection("users");

    const current = await users.findOne(
      { _id: new ObjectId(session.userId) },
      { projection: { publicProfile: 1 } }
    );
    const existingProfile = current?.publicProfile as PublicProfileSettings | undefined;

    let finalSlug = existingProfile?.slug ?? generateSlug();
    if (slug != null && typeof slug === "string") {
      const trimmed = slug.trim().toLowerCase();
      if (!SLUG_REGEX.test(trimmed)) {
        return NextResponse.json(
          { error: "Slug must be 4–32 chars: letters, numbers, hyphens, underscores" },
          { status: 400 }
        );
      }
      const taken = await users.findOne(
        {
          "publicProfile.slug": trimmed,
          _id: { $ne: new ObjectId(session.userId) },
        },
        { projection: { _id: 1 } }
      );
      if (taken) {
        return NextResponse.json(
          { error: "This URL slug is already taken" },
          { status: 400 }
        );
      }
      finalSlug = trimmed;
    }

    const publicProfile: PublicProfileSettings = {
      enabled: !!enabled,
      slug: finalSlug,
      dateFrom: typeof dateFrom === "string" ? dateFrom : (existingProfile?.dateFrom ?? ""),
      dateTo: typeof dateTo === "string" ? dateTo : (existingProfile?.dateTo ?? ""),
    };

    await users.updateOne(
      { _id: new ObjectId(session.userId) },
      { $set: { publicProfile } }
    );

    return NextResponse.json({ ok: true, settings: publicProfile });
  } catch (e) {
    console.error("Profile POST error:", e);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
