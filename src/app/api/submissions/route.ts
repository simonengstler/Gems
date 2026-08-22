import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { normalizeSongTitle, splitArtistAndTitle } from "@/lib/song-identity";
import { resolveSongIdentity } from "@/lib/song-metadata";

type ExistingSubmission = {
  id: string;
  song_url: string;
  title: string | null;
  normalized_title: string | null;
};

function identityColumns(identity: Awaited<ReturnType<typeof resolveSongIdentity>>) {
  return {
    title: identity.title,
    artist: identity.artist,
    thumbnail_url: identity.thumbnailUrl,
    provider: identity.provider,
    provider_item_id: identity.providerItemId,
    media_kind: identity.mediaKind,
    normalized_title: identity.normalizedTitle,
    normalized_artist: identity.normalizedArtist,
    version_key: identity.versionKey,
  };
}

function couldMatchTitle(submission: ExistingSubmission, normalizedTitle: string) {
  const stored = submission.normalized_title
    || normalizeSongTitle(splitArtistAndTitle(submission.title || "").title).normalizedTitle;
  return Boolean(stored && (stored === normalizedTitle || stored.includes(normalizedTitle) || normalizedTitle.includes(stored)));
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const body = await request.json().catch(() => null) as { groupId?: string; roundId?: string; url?: string } | null;
  if (!token || !body?.groupId || !body.roundId || !body.url) {
    return NextResponse.json({ error: "Missing authentication or submission details.", code: "INVALID_REQUEST" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Song submissions are not configured.", code: "NOT_CONFIGURED" }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Invalid session.", code: "INVALID_SESSION" }, { status: 401 });
  }

  const [{ data: membership }, { data: round }] = await Promise.all([
    admin.from("group_members").select("status").eq("group_id", body.groupId).eq("user_id", auth.user.id).maybeSingle(),
    admin.from("rounds").select("id,group_id,round_number,starts_at,submission_ends_at").eq("id", body.roundId).eq("group_id", body.groupId).maybeSingle(),
  ]);
  if (membership?.status !== "approved") {
    return NextResponse.json({ error: "Approved Circle membership is required.", code: "NOT_APPROVED" }, { status: 403 });
  }
  const now = Date.now();
  if (!round || now < new Date(round.starts_at).getTime() || now >= new Date(round.submission_ends_at).getTime()) {
    return NextResponse.json({ error: "Submissions may only be changed during choosing.", code: "SUBMISSION_CLOSED" }, { status: 409 });
  }

  try {
    const identity = await resolveSongIdentity(body.url.trim());

    // Older rows predate semantic identities. Enrich only plausible title matches,
    // keeping the normal request small while making existing Circle history count.
    const { data: priorRounds } = await admin
      .from("rounds")
      .select("id")
      .eq("group_id", body.groupId)
      .lt("round_number", round.round_number);
    const priorRoundIds = (priorRounds || []).map((item) => item.id);
    if (priorRoundIds.length) {
      const { data: unresolved } = await admin
        .from("submissions")
        .select("id,song_url,title,normalized_title")
        .in("round_id", priorRoundIds)
        .is("normalized_title", null);
      const candidates = ((unresolved || []) as ExistingSubmission[])
        .filter((item) => couldMatchTitle(item, identity.normalizedTitle))
        .slice(0, 8);
      await Promise.all(candidates.map(async (candidate) => {
        try {
          const historicalIdentity = await resolveSongIdentity(candidate.song_url);
          await admin.from("submissions").update(identityColumns(historicalIdentity)).eq("id", candidate.id);
        } catch {
          // Provider metadata can disappear. Existing provider IDs and stored
          // metadata remain available as conservative fallbacks.
        }
      }));
    }

    const payload = {
      group_id: body.groupId,
      round_id: body.roundId,
      user_id: auth.user.id,
      song_url: identity.canonicalUrl,
      ...identityColumns(identity),
    };
    const { data: saved, error } = await admin
      .from("submissions")
      .upsert(payload, { onConflict: "round_id,user_id" })
      .select("*")
      .single();

    if (error?.message.includes("song_already_used")) {
      return NextResponse.json({ error: "This song was already used in an earlier round.", code: "DUPLICATE_SONG" }, { status: 409 });
    }
    if (error) throw error;
    return NextResponse.json({ submission: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The song could not be submitted.";
    const invalid = /unsupported|metadata|recogn/i.test(message);
    return NextResponse.json({ error: message, code: invalid ? "INVALID_SONG" : "SUBMISSION_FAILED" }, { status: invalid ? 400 : 500 });
  }
}
