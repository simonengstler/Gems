import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const { groupId } = await request.json() as { groupId?: string };
  if (!token || !groupId) {
    return NextResponse.json({ error: "Missing authentication or group." }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }
  const [{ data: membership }, { data: group }] = await Promise.all([
    admin.from("group_members").select("role,status").eq("group_id", groupId).eq("user_id", authData.user.id).maybeSingle(),
    admin.from("groups").select("created_by").eq("id", groupId).maybeSingle(),
  ]);
  const isApprovedAdmin = membership?.role === "admin" && membership.status === "approved";
  if (!isApprovedAdmin && group?.created_by !== authData.user.id) {
    return NextResponse.json({ error: "Only the group admin can seed data." }, { status: 403 });
  }

  try {
    const stamp = Date.now().toString().slice(-7);
    const names = ["Nova", "Moss", "Echo"];
    const userIds: string[] = [];
    for (const [index, nickname] of names.entries()) {
      const { data, error } = await admin.auth.admin.createUser({
        email: `gems-${stamp}-${index}@example.test`,
        password: "LocalTesting!24",
        email_confirm: true,
      });
      if (error) throw error;
      userIds.push(data.user.id);
      const { error: profileError } = await admin.from("users").insert({
        id: data.user.id,
        nickname: `${nickname}${stamp.slice(-3)}${index}`,
        streak: index + 1,
      });
      if (profileError) throw profileError;
    }

    const { error: memberError } = await admin.from("group_members").insert(
      userIds.map((userId) => ({
        group_id: groupId,
        user_id: userId,
        role: "member",
        status: "approved",
        approved_by: authData.user!.id,
        approved_at: new Date().toISOString(),
      })),
    );
    if (memberError) throw memberError;

    const { data: previous } = await admin
      .from("rounds")
      .select("round_number")
      .eq("group_id", groupId)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const starts = new Date();
    const submissionEnd = new Date(starts.getTime() + 5 * 86400000);
    const ratingEnd = new Date(starts.getTime() + 12 * 86400000);
    const { data: round, error: roundError } = await admin.from("rounds").insert({
      group_id: groupId,
      round_number: (previous?.round_number || 0) + 1,
      starts_at: starts.toISOString(),
      submission_ends_at: submissionEnd.toISOString(),
      rating_ends_at: ratingEnd.toISOString(),
    }).select().single();
    if (roundError) throw roundError;

    const urls = [
      "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX",
    ];
    const { data: songs, error: songError } = await admin.from("submissions").insert(
      userIds.map((userId, index) => ({
        group_id: groupId,
        round_id: round.id,
        user_id: userId,
        song_url: urls[index],
      })),
    ).select();
    if (songError) throw songError;

    await admin.from("rounds").update({
      starts_at: new Date(starts.getTime() - 6 * 86400000).toISOString(),
      submission_ends_at: new Date(submissionEnd.getTime() - 6 * 86400000).toISOString(),
      rating_ends_at: new Date(ratingEnd.getTime() - 6 * 86400000).toISOString(),
    }).eq("id", round.id);

    const emojis = ["🖤", "❤️", "👍", "👌", "🤔"];
    const { error: ratingError } = await admin.from("ratings").insert(
      userIds.flatMap((userId, userIndex) =>
        (songs || []).map((song, songIndex) => ({
          group_id: groupId,
          round_id: round.id,
          submission_id: song.id,
          user_id: userId,
          emoji: emojis[(userIndex + songIndex) % emojis.length],
        })),
      ),
    );
    if (ratingError) throw ratingError;
    return NextResponse.json({ ok: true, password: "LocalTesting!24" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not seed dummy data." },
      { status: 500 },
    );
  }
}
