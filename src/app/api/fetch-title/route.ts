import { NextResponse } from "next/server";

const LINKEDIN_URL_PATTERN = /^https:\/\/(www\.)?linkedin\.com\//i;

function isGenericTitle(t: string): boolean {
  return !t || /^Sign In|Log In|LinkedIn\s*$/i.test(t) || /^[\s#|]+$/.test(t);
}

/** "video" | "repost" | "post" from LinkedIn public post HTML */
export type LinkedInPostType = "video" | "repost" | "post";

function extractPostType(html: string): LinkedInPostType {
  if (html.includes('"@type":"VideoObject"') || html.includes('"@type": "VideoObject"')) {
    return "video";
  }
  if (html.includes("urn:li:share") && /data-attributed-urn=["']urn:li:share:/i.test(html)) {
    return "repost";
  }
  return "post";
}

function extractTitle(html: string): string | null {
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of jsonLdMatches) {
    const raw = m[1];
    if (!raw) continue;
    // 1a. JSON-LD VideoObject: use headline or name (e.g. "Like many of us, i'm spending...")
    if (raw.includes("VideoObject")) {
      try {
        const json = JSON.parse(raw);
        if (json?.["@type"] === "VideoObject") {
          const headline = json.headline ?? json.name;
          if (headline && typeof headline === "string") {
            const t = headline.trim();
            if (t && !isGenericTitle(t)) return t;
          }
        }
      } catch {
        const headlineMatch = raw.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (headlineMatch) {
          const t = headlineMatch[1].replace(/\\"/g, '"').trim();
          if (t && !isGenericTitle(t)) return t;
        }
      }
      continue;
    }
    // 1b. JSON-LD SocialMediaPosting: headline is the post's first line
    if (!raw?.includes("SocialMediaPosting") || !raw?.includes("headline")) continue;
    try {
      const json = JSON.parse(raw);
      if (json?.["@type"] === "SocialMediaPosting") {
        const headline = json.headline ?? json.name;
        if (headline && typeof headline === "string") {
          const t = headline.trim();
          if (t && !isGenericTitle(t)) return t;
        }
      }
    } catch {
      // try headline regex as fallback when JSON has escaped chars
      const headlineMatch = raw.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (headlineMatch) {
        const t = headlineMatch[1].replace(/\\"/g, '"').trim();
        if (t && !isGenericTitle(t)) return t;
      }
    }
  }

  // 2. og:title (public posts: "#hashtags | Author" or sometimes better)
  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogTitleMatch) {
    const t = ogTitleMatch[1].trim();
    if (t && !isGenericTitle(t)) return t;
  }

  // 3. meta description (full post content) - use first line as title
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (descMatch) {
    const desc = descMatch[1].trim();
    if (desc && !isGenericTitle(desc)) {
      const firstLine = desc.split(/\r?\n/)[0]?.trim();
      if (firstLine && firstLine.length <= 120) return firstLine;
    }
  }

  // 4. <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const t = titleMatch[1].trim();
    if (t && !isGenericTitle(t)) return t;
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
    const postType = extractPostType(html);

    if (!title) {
      return NextResponse.json(
        { error: "No title found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ title, postType });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch title";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
