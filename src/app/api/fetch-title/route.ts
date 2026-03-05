import { NextResponse } from "next/server";

const LINKEDIN_URL_PATTERN = /^https:\/\/(www\.)?linkedin\.com\//i;

function extractTitle(html: string): string | null {
  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogTitleMatch) {
    const t = ogTitleMatch[1].trim();
    if (t && !/^Sign In|Log In|LinkedIn$/i.test(t)) return t;
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const t = titleMatch[1].trim();
    if (t && !/^Sign In|Log In|LinkedIn\s*$/i.test(t)) return t;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url || !LINKEDIN_URL_PATTERN.test(url)) {
      return NextResponse.json(
        { error: "Invalid or non-LinkedIn URL" },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const title = extractTitle(html);

    if (!title) {
      return NextResponse.json(
        { error: "No title found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ title });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch title";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
