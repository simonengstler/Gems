import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type RoundEvent = "round_started" | "rating_started" | "round_completed";

const eventCopy: Record<RoundEvent, { subject: (groupName: string) => string; body: string }> = {
  round_started: {
    subject: (groupName) => `Gems · ${groupName}: new round started`,
    body: "Submit one musical gem before the choosing interval closes.",
  },
  rating_started: {
    subject: (groupName) => `Gems · ${groupName}: songs are ready`,
    body: "Listen to every song and leave exactly one reaction.",
  },
  round_completed: {
    subject: (groupName) => `Gems · ${groupName}: results are ready`,
    body: "The round is complete. See which gems your Circle loved.",
  },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] || character);
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { groupId, roundId, event, timeMachine } = await request.json() as { groupId?: string; roundId?: string; event?: RoundEvent; timeMachine?: boolean };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!token || !groupId || !roundId || !event || !(event in eventCopy)) return NextResponse.json({ error: "Missing notification event details." }, { status: 400 });
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Notifications are not configured." }, { status: 503 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Your session could not be verified." }, { status: 401 });

  const [{ data: membership }, { data: round }, { data: settings }, { data: group }] = await Promise.all([
    admin.from("group_members").select("role,status").eq("group_id", groupId).eq("user_id", auth.user.id).maybeSingle(),
    admin.from("rounds").select("id,starts_at,submission_ends_at,rating_ends_at").eq("id", roundId).eq("group_id", groupId).maybeSingle(),
    admin.from("group_settings").select("email_notifications_enabled,round_started_email,rating_started_email,round_completed_email").eq("group_id", groupId).maybeSingle(),
    admin.from("groups").select("name").eq("id", groupId).maybeSingle(),
  ]);
  if (membership?.role !== "admin" || membership.status !== "approved") return NextResponse.json({ error: "Only an approved circle admin can send round notifications." }, { status: 403 });
  if (!round || !group) return NextResponse.json({ error: "Round not found." }, { status: 404 });

  const eventAt = new Date(event === "round_started" ? round.starts_at : event === "rating_started" ? round.submission_ends_at : round.rating_ends_at).getTime();
  const now = Date.now();
  const matchesShiftedPhase = event === "rating_started"
    ? now >= new Date(round.submission_ends_at).getTime() && now < new Date(round.rating_ends_at).getTime()
    : event === "round_completed" && now >= new Date(round.rating_ends_at).getTime();
  const newlyStarted = eventAt <= now + 30_000 && now - eventAt <= 5 * 60_000;
  if (!newlyStarted && !(timeMachine && matchesShiftedPhase)) return NextResponse.json({ error: "Only a newly started round phase can send an immediate notification." }, { status: 409 });
  const eventEnabled = event === "round_started"
    ? settings?.round_started_email
    : event === "rating_started"
      ? settings?.rating_started_email
      : settings?.round_completed_email;
  if (!settings?.email_notifications_enabled || !eventEnabled) {
    console.info("round email skipped", { event, reason: "disabled" });
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (!apiKey || !from) return NextResponse.json({ error: "Email delivery is not configured." }, { status: 503 });

  const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", groupId).eq("status", "approved");
  const copy = eventCopy[event];
  let sent = 0;
  let failed = 0;

  for (const member of members || []) {
    const { data: existing } = await admin.from("notification_log").select("id").eq("round_id", roundId).eq("notification_type", event).eq("recipient_id", member.user_id).maybeSingle();
    if (existing) continue;
    const { data: user } = await admin.auth.admin.getUserById(member.user_id);
    if (!user.user?.email) continue;
    const result = await new Resend(apiKey).emails.send({
      from,
      to: user.user.email,
      subject: copy.subject(group.name),
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="color:#174f3d">💎 Gems</h1><p><strong>Circle: ${escapeHtml(group.name)}</strong></p><h2>${escapeHtml(copy.subject(group.name))}</h2><p>${copy.body}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://gems-music.com"}">Open Gems</a></p></div>`,
    });
    if (result.error) { failed++; continue; }
    const { error: logError } = await admin.from("notification_log").insert({
      group_id: groupId, round_id: roundId, notification_type: event,
      recipient_id: member.user_id, provider_id: result.data?.id,
    });
    if (logError) failed++; else sent++;
  }

  console.info("round email completed", { event, sent, failed });
  return NextResponse.json({ ok: true, sent, failed });
}
