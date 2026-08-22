import "server-only";

import {
  identityFromMetadata,
  parseProviderUrl,
  type SongIdentity,
} from "@/lib/song-identity";

const FETCH_TIMEOUT_MS = 8_000;

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/json",
      "accept-language": "en",
      "user-agent": "Gems/1.0 (https://gems-music.com)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Song metadata is unavailable.");
  return response.text();
}

export async function resolveSongIdentity(url: string): Promise<SongIdentity> {
  const reference = parseProviderUrl(url);
  if (!reference) throw new Error("Unsupported song URL.");

  const oEmbedUrl = reference.provider === "youtube"
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(reference.canonicalUrl)}&format=json`
    : `https://open.spotify.com/oembed?url=${encodeURIComponent(reference.canonicalUrl)}`;

  const [oEmbedResult, pageResult] = await Promise.allSettled([
    fetchText(oEmbedUrl),
    reference.provider === "spotify" ? fetchText(reference.canonicalUrl) : Promise.resolve(""),
  ]);
  const oEmbed = (oEmbedResult.status === "fulfilled" ? JSON.parse(oEmbedResult.value) : {}) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  const pageHtml = pageResult.status === "fulfilled" ? pageResult.value : "";

  return identityFromMetadata(reference, pageHtml, oEmbed);
}
