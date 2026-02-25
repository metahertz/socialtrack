import { NextResponse } from "next/server";

const YOUTUBE_CHANNEL_NAME = "VimandTonic";

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(YOUTUBE_CHANNEL_NAME)}&key=${apiKey}`
    );
    const searchData = await searchRes.json();
    if (searchData.error) {
      return NextResponse.json(
        { error: searchData.error.message || "YouTube API error" },
        { status: 502 }
      );
    }
    const channelId = searchData.items?.[0]?.snippet?.channelId;
    if (!channelId) {
      return NextResponse.json(
        { error: `Channel "${YOUTUBE_CHANNEL_NAME}" not found` },
        { status: 404 }
      );
    }

    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const stats = channel.statistics || {};
    return NextResponse.json({
      channelId,
      title: channel.snippet?.title || YOUTUBE_CHANNEL_NAME,
      subscriberCount: parseInt(stats.subscriberCount || "0", 10),
      viewCount: parseInt(stats.viewCount || "0", 10),
      videoCount: parseInt(stats.videoCount || "0", 10),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch YouTube channel" },
      { status: 500 }
    );
  }
}
