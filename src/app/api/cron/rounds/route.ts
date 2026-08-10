import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const pushConfigured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (pushConfigured) {
    webpush.setVapidDetails(
      `mailto:${process.env.RESEND_FROM_EMAIL || "admin@example.com"}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }
  const { data: settings, error } = await admin
    .from("group_settings")
    .select("*,groups(id,name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let dryRun = 0;
  let roundsStarted = 0;
  const now = Date.now();

  for (const setting of settings || []) {
    const group = setting.groups as unknown as { id: string; name: string };
    const { data: round } = await admin.from("rounds").select("*").eq("group_id", group.id)
      .order("round_number", { ascending: false }).limit(1).maybeSingle();
    let activeRound = round;
    let roundStartedAutomatically = false;

    if (setting.auto_start_rounds && round && new Date(round.rating_ends_at).getTime() <= now) {
      const starts = new Date();
      const { data: startedRound, error: startError } = await admin.from("rounds").insert({
        group_id: group.id,
        round_number: round.round_number + 1,
        starts_at: starts.toISOString(),
        submission_ends_at: new Date(starts.getTime() + setting.submission_interval_days * 86400000).toISOString(),
        rating_ends_at: new Date(starts.getTime() + (setting.submission_interval_days + setting.rating_interval_days) * 86400000).toISOString(),
      }).select("*").single();
      if (!startError && startedRound) {
        activeRound = startedRound;
        roundStartedAutomatically = true;
        roundsStarted++;
      }
    }

    if ((!setting.email_notifications_enabled && !setting.push_notifications_enabled) || !activeRound) continue;
    const submissionEnds = new Date(activeRound.submission_ends_at).getTime();
    const ratingEnds = new Date(activeRound.rating_ends_at).getTime();
    const candidates: { type: string; enabled: boolean; subject: string; body: string; active: boolean }[] = [
      { type: "round_started", enabled: setting.round_started_email, subject: `${group.name}: a new Gems round started`, body: "Submit one musical gem before the choosing interval closes.", active: roundStartedAutomatically },
      { type: "rating_started", enabled: setting.rating_started_email, subject: `${group.name}: the gems are unlocked`, body: "Listen to every song and leave exactly one reaction.", active: now >= submissionEnds && now - submissionEnds <= 24 * 3600000 && now < ratingEnds },
      { type: "streak_warning", enabled: setting.streak_warning_email, subject: `${group.name}: your streak is in danger`, body: "Finish your ratings before the interval closes.", active: ratingEnds - now > 0 && ratingEnds - now <= 24 * 3600000 },
    ];
    const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", group.id).eq("status", "approved");
    for (const candidate of candidates.filter((item) => item.enabled && item.active)) {
      for (const member of members || []) {
        const { data: existing } = await admin.from("notification_log").select("id")
          .eq("round_id", activeRound.id).eq("notification_type", candidate.type).eq("recipient_id", member.user_id).maybeSingle();
        if (existing) continue;
        const { data: user } = await admin.auth.admin.getUserById(member.user_id);
        if (!user.user?.email) continue;
        let delivered = false;
        let providerId: string | undefined;
        if (setting.email_notifications_enabled) {
          if (!resend) dryRun++;
          else {
            const result = await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || "Gems <onboarding@resend.dev>",
              to: user.user.email,
              subject: candidate.subject,
              html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="color:#174f3d">💎 Gems</h1><h2>${candidate.subject}</h2><p>${candidate.body}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}">Open Gems</a></p></div>`,
            });
            if (!result.error) { delivered = true; providerId = result.data?.id; sent++; }
          }
        }
        if (setting.push_notifications_enabled && pushConfigured) {
          const { data: subscriptions } = await admin.from("push_subscriptions").select("*").eq("user_id", member.user_id);
          for (const subscription of subscriptions || []) {
            try {
              await webpush.sendNotification({
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              }, JSON.stringify({ title: candidate.subject, body: candidate.body, url: process.env.NEXT_PUBLIC_APP_URL || "/" }));
              delivered = true;
            } catch {
              // Expired browser subscriptions are harmless and can be replaced by opting in again.
            }
          }
        }
        if (delivered) {
          await admin.from("notification_log").insert({
            group_id: group.id, round_id: activeRound.id, notification_type: candidate.type,
            recipient_id: member.user_id, provider_id: providerId,
          });
        }
      }
    }
  }
  return NextResponse.json({ ok: true, sent, dryRun, roundsStarted, emailConfigured: Boolean(resend), pushConfigured });
}
