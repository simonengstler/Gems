import { NextRequest, NextResponse } from "next/server";
import { resolveSongIdentity } from "@/lib/song-metadata";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing URL." }, { status: 400 });
  try {
    const identity = await resolveSongIdentity(url);
    return NextResponse.json({
      title: identity.title,
      artist: identity.artist,
      thumbnailUrl: identity.thumbnailUrl,
      provider: identity.provider,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid URL." }, { status: 400 });
  }
}
