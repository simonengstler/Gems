export type SongProvider = "spotify" | "youtube";
export type MediaKind = "track" | "album" | "video";

export type ProviderReference = {
  provider: SongProvider;
  providerItemId: string;
  mediaKind: MediaKind;
  canonicalUrl: string;
};

export type SongIdentity = ProviderReference & {
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  normalizedTitle: string;
  normalizedArtist: string;
  versionKey: string;
};

const VARIANT_PATTERN = /\b(remix|mix|edit|rework|live|acoustic|cover|instrumental|demo|unplugged|orchestral|sped[ -]?up|slowed(?:[ -](?:down|and[ -]reverb))?|radio version|extended version)\b/i;
const PRESENTATION_PATTERN = /\b(official(?: music)? video|official audio|music video|lyric(?:s| video)?|visuali[sz]er|audio only|hd|uhd|\d+k remaster)\b/i;

function isProviderHost(hostname: string, provider: SongProvider) {
  const host = hostname.toLowerCase();
  if (provider === "spotify") return host === "open.spotify.com" || host === "spotify.com" || host.endsWith(".spotify.com");
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
}

export function parseProviderUrl(value: string): ProviderReference | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

    if (isProviderHost(parsed.hostname, "spotify")) {
      const match = parsed.pathname.match(/^\/(track|album)\/([a-zA-Z0-9]+)(?:\/|$)/);
      if (!match) return null;
      const mediaKind = match[1] as "track" | "album";
      return {
        provider: "spotify",
        providerItemId: match[2],
        mediaKind,
        canonicalUrl: `https://open.spotify.com/${mediaKind}/${match[2]}`,
      };
    }

    if (isProviderHost(parsed.hostname, "youtube")) {
      const id = parsed.hostname.toLowerCase() === "youtu.be"
        ? parsed.pathname.slice(1).split("/")[0]
        : parsed.searchParams.get("v") || parsed.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
      return {
        provider: "youtube",
        providerItemId: id,
        mediaKind: "video",
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeArtist(value: string | null | undefined) {
  return normalizeText((value || "")
    .replace(/\b(?:official|vevo|topic)\b/gi, " ")
    .replace(/\b(?:feat(?:uring)?|ft)\.?\b/gi, " "));
}

export function splitArtistAndTitle(rawTitle: string, fallbackArtist?: string | null) {
  const cleaned = rawTitle.replace(/\s+/g, " ").trim();
  const separator = cleaned.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (separator) return { artist: separator[1].trim(), title: separator[2].trim() };
  return { artist: fallbackArtist?.trim() || null, title: cleaned };
}

export function normalizeSongTitle(rawTitle: string) {
  const variants: string[] = [];
  let title = rawTitle;

  title = title.replace(/[([]([^\])]+)[\])]/g, (whole, qualifier: string) => {
    if (VARIANT_PATTERN.test(qualifier)) {
      variants.push(qualifier);
      return " ";
    }
    return PRESENTATION_PATTERN.test(qualifier) ? " " : whole;
  });

  title = title.replace(/\s+[-–—]\s+([^–—-]+)$/g, (whole, qualifier: string) => {
    if (VARIANT_PATTERN.test(qualifier)) {
      variants.push(qualifier);
      return " ";
    }
    return whole;
  });

  title = title
    .replace(/\b(?:feat(?:uring)?|ft)\.?\s+.+$/i, " ")
    .replace(/\b(?:official(?: music)? video|official audio|music video|lyric(?:s| video)?|visuali[sz]er|audio only)\b/gi, " ");

  return {
    normalizedTitle: normalizeText(title),
    versionKey: normalizeText(variants.join(" ")),
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function readMetaTags(html: string) {
  const result = new Map<string, string>();
  for (const tag of html.match(/<meta\s+[^>]*>/gi) || []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
      attributes.set(match[1].toLowerCase(), decodeHtml(match[3].trim()));
    }
    const key = attributes.get("property") || attributes.get("name") || attributes.get("itemprop");
    const content = attributes.get("content");
    if (key && content && !result.has(key.toLowerCase())) result.set(key.toLowerCase(), content);
  }
  return result;
}

export function identityFromMetadata(reference: ProviderReference, html: string, oEmbed?: {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}) : SongIdentity {
  const meta = readMetaTags(html);
  const rawTitle = meta.get("og:title") || oEmbed?.title || "";
  if (!rawTitle) throw new Error("Song metadata is unavailable.");

  let artist: string | null = meta.get("music:musician_description") || null;
  if (!artist && reference.provider === "spotify") {
    artist = meta.get("og:description")?.split("·")[0]?.trim() || null;
  }

  const parsed = reference.provider === "youtube"
    ? splitArtistAndTitle(rawTitle, oEmbed?.author_name?.replace(/(?:VEVO|\s+-\s+Topic)$/i, ""))
    : { artist, title: rawTitle };
  const normalized = normalizeSongTitle(parsed.title);
  if (!normalized.normalizedTitle) throw new Error("Song title could not be recognized.");

  return {
    ...reference,
    title: parsed.title,
    artist: parsed.artist,
    thumbnailUrl: meta.get("og:image") || oEmbed?.thumbnail_url || null,
    normalizedTitle: normalized.normalizedTitle,
    normalizedArtist: normalizeArtist(parsed.artist),
    versionKey: normalized.versionKey,
  };
}

export function areLikelySameRecording(left: Pick<SongIdentity, "mediaKind" | "normalizedTitle" | "normalizedArtist" | "versionKey">, right: Pick<SongIdentity, "mediaKind" | "normalizedTitle" | "normalizedArtist" | "versionKey">) {
  if (left.mediaKind !== right.mediaKind && left.mediaKind !== "video" && right.mediaKind !== "video") return false;
  if (left.normalizedTitle !== right.normalizedTitle) return false;
  if (left.versionKey !== right.versionKey) return false;
  return Boolean(left.normalizedArtist && right.normalizedArtist && left.normalizedArtist === right.normalizedArtist);
}
