import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type RoundEvent = "round_started" | "rating_started";

const eventCopy: Record<RoundEvent, { subject: (groupName: string) => string; body: string }> = {
  round_started: {
    subject: (groupName) => `${groupName}: a new Gems round started`,
    body: "Submit one musical gem before the choosing interval closes.",
  },
  rating_started: {
    subject: (groupName) => `${groupName}: the gems are unlocked`,
    body: "Listen to every song and leave exactly one reaction.",
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
  const { groupId, roundId, event } = await request.json() as { groupId?: string; roundId?: string; event?: RoundEvent };
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
    admin.from("rounds").select("id,starts_at,submission_ends_at").eq("id", roundId).eq("group_id", groupId).maybeSingle(),
    admin.from("group_settings").select("email_notifications_enabled,round_started_email,rating_started_email").eq("group_id", groupId).maybeSingle(),
    admin.from("groups").select("name").eq("id", groupId).maybeSingle(),
  ]);
  if (membership?.role !== "admin" || membership.status !== "approved") return NextResponse.json({ error: "Only an approved circle admin can send round notifications." }, { status: 403 });
  if (!round || !group) return NextResponse.json({ error: "Round not found." }, { status: 404 });

  const eventAt = new Date(event === "round_started" ? round.starts_at : round.submission_ends_at).getTime();
  const now = Date.now();
  if (eventAt > now + 30_000 || now - eventAt > 5 * 60_000) return NextResponse.json({ error: "Only a newly started round phase can send an immediate notification." }, { status: 409 });
  if (!settings?.email_notifications_enabled || (event === "round_started" ? !settings.round_started_email : !settings.rating_started_email)) return NextResponse.json({ ok: true, skipped: true });
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
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="color:#174f3d">💎 Gems</h1><h2>${escapeHtml(copy.subject(group.name))}</h2><p>${copy.body}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://gems-music.com"}">Open Gems</a></p></div>`,
    });
    if (result.error) { failed++; continue; }
    const { error: logError } = await admin.from("notification_log").insert({
      group_id: groupId, round_id: roundId, notification_type: event,
      recipient_id: member.user_id, provider_id: result.data?.id,
    });
    if (logError) failed++; else sent++;
  }

  return NextResponse.json({ ok: true, sent, failed });
}
