import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing URL." }, { status: 400 });
  try {
    const parsed = new URL(url);
    const isYouTube = parsed.hostname === "youtu.be" || parsed.hostname.includes("youtube.com");
    const isSpotify = parsed.hostname.includes("spotify.com");
    if (!isYouTube && !isSpotify) throw new Error("Unsupported music provider.");
    const endpoint = isYouTube
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      : `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error("Metadata is unavailable for this link.");
    const data = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
    return NextResponse.json({
      title: data.title || null,
      artist: data.author_name || null,
      thumbnailUrl: data.thumbnail_url || null,
      provider: isYouTube ? "youtube" : "spotify",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid URL." }, { status: 400 });
  }
}
