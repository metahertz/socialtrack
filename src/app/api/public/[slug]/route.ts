import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { StoredLinkedInData } from "@/lib/linkedinImport";
import type { StoredYouTubeData } from "@/lib/youtubeImport";

export interface PublicProfilePayload {
  linkedIn: StoredLinkedInData | null;
  youtube: StoredYouTubeData | null;
  dateFrom: string;
  dateTo: string;
}

function filterByDateRange<T extends { date: string }>(
  items: T[],
  from: string,
  to: string
): T[] {
  if (!from || !to) return items;
  return items.filter((x) => x.date >= from && x.date <= to);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne(
      {
        "publicProfile.enabled": true,
        "publicProfile.slug": slug.trim().toLowerCase(),
      },
      { projection: { _id: 1, publicProfile: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profile = user.publicProfile as {
      dateFrom?: string;
      dateTo?: string;
    };
    const dateFrom = profile?.dateFrom ?? "";
    const dateTo = profile?.dateTo ?? "";
    const userId = (user._id as ObjectId).toString();

    const [linkedInDoc, youtubeDoc] = await Promise.all([
      db.collection("linkedin_data").findOne({ userId }),
      db.collection("youtube_data").findOne({ userId }),
    ]);

    let linkedIn: StoredLinkedInData | null = null;
    if (linkedInDoc) {
      const { _id, userId: _u, ...data } = linkedInDoc;
      const raw = data as StoredLinkedInData;
      linkedIn = {
        ...raw,
        dailyImpressions: filterByDateRange(
          raw.dailyImpressions ?? [],
          dateFrom,
          dateTo
        ),
        posts: filterByDateRange(raw.posts ?? [], dateFrom, dateTo),
        followersByDate: raw.followersByDate ?? [],
      };
    }

    let youtube: StoredYouTubeData | null = null;
    if (youtubeDoc) {
      const { _id, userId: _u, ...data } = youtubeDoc;
      const raw = data as StoredYouTubeData;
      youtube = {
        ...raw,
        dailyData: filterByDateRange(raw.dailyData ?? [], dateFrom, dateTo),
        videos: (raw.videos ?? []).filter((v) => {
          if (!dateFrom || !dateTo) return true;
          return v.publishedDate >= dateFrom && v.publishedDate <= dateTo;
        }),
        chartVideos: filterByDateRange(
          raw.chartVideos ?? [],
          dateFrom,
          dateTo
        ),
      };
    }

    return NextResponse.json({
      linkedIn,
      youtube,
      dateFrom,
      dateTo,
    } satisfies PublicProfilePayload);
  } catch (e) {
    console.error("Public profile GET error:", e);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
