import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";

export const dynamic = "force-dynamic";

const REMINDER_WINDOW_MS = 48 * 3600000;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] || character);
}

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
    const startsAt = new Date(activeRound.starts_at).getTime();
    const submissionEnds = new Date(activeRound.submission_ends_at).getTime();
    const ratingEnds = new Date(activeRound.rating_ends_at).getTime();
    const completedRound = round && now >= new Date(round.rating_ends_at).getTime() ? round : null;
    const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", group.id).eq("status", "approved");
    const [{ data: submissions }, { data: ratings }] = await Promise.all([
      admin.from("submissions").select("id,user_id").eq("round_id", activeRound.id),
      admin.from("ratings").select("submission_id,user_id").eq("round_id", activeRound.id),
    ]);
    const submittedUserIds = new Set((submissions || []).map((submission) => submission.user_id));
    const submissionReminderRecipients = new Set(
      (members || []).filter((member) => !submittedUserIds.has(member.user_id)).map((member) => member.user_id),
    );
    const ratingReminderRecipients = new Set<string>();
    for (const member of members || []) {
      const eligibleSubmissionIds = new Set(
        (submissions || []).filter((submission) => submission.user_id !== member.user_id).map((submission) => submission.id),
      );
      const completedRatings = new Set(
        (ratings || []).filter((rating) => rating.user_id === member.user_id && eligibleSubmissionIds.has(rating.submission_id)).map((rating) => rating.submission_id),
      );
      if (eligibleSubmissionIds.size > completedRatings.size) ratingReminderRecipients.add(member.user_id);
    }
    const candidates: { round: typeof activeRound; type: string; enabled: boolean; subject: string; body: string; active: boolean; recipients?: Set<string>; emailOnly?: boolean }[] = [
      { round: activeRound, type: "round_started", enabled: setting.round_started_email, subject: `Gems · ${group.name}: new round started`, body: "Submit one musical gem before the choosing interval closes.", active: roundStartedAutomatically },
      { round: activeRound, type: "submission_reminder", enabled: setting.phase_reminder_email, subject: `Gems · ${group.name}: less than two days left / weniger als zwei Tage`, body: "You still need to add your song before choosing ends.<br>Du musst deinen Song noch hinzufügen, bevor die Auswahl endet.", active: submissionEnds - startsAt > REMINDER_WINDOW_MS && now < submissionEnds && submissionEnds - now <= REMINDER_WINDOW_MS, recipients: submissionReminderRecipients, emailOnly: true },
      { round: activeRound, type: "rating_started", enabled: setting.rating_started_email, subject: `Gems · ${group.name}: songs are ready`, body: "Listen to every song and leave exactly one reaction.", active: now >= submissionEnds && now - submissionEnds <= 24 * 3600000 && now < ratingEnds },
      { round: activeRound, type: "rating_reminder", enabled: setting.phase_reminder_email, subject: `Gems · ${group.name}: less than two days left / weniger als zwei Tage`, body: "You still have songs to react to before listening ends.<br>Du musst noch auf Songs reagieren, bevor das Hören endet.", active: ratingEnds - submissionEnds > REMINDER_WINDOW_MS && now >= submissionEnds && now < ratingEnds && ratingEnds - now <= REMINDER_WINDOW_MS, recipients: ratingReminderRecipients, emailOnly: true },
      { round: completedRound, type: "round_completed", enabled: setting.round_completed_email, subject: `Gems · ${group.name}: results are ready`, body: "The round is complete. See which gems your Circle loved.", active: Boolean(completedRound && now - new Date(completedRound.rating_ends_at).getTime() <= 24 * 3600000) },
    ];
    for (const candidate of candidates.filter((item) => item.enabled && item.active)) {
      if (!candidate.round) continue;
      for (const member of (members || []).filter((item) => !candidate.recipients || candidate.recipients.has(item.user_id))) {
        const { data: existing } = await admin.from("notification_log").select("id")
          .eq("round_id", candidate.round.id).eq("notification_type", candidate.type).eq("recipient_id", member.user_id).maybeSingle();
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
              html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="color:#174f3d">💎 Gems</h1><p><strong>Circle: ${escapeHtml(group.name)}</strong></p><h2>${escapeHtml(candidate.subject)}</h2><p>${candidate.body}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://gems-music.com"}">Open Gems</a></p></div>`,
            });
            if (!result.error) { delivered = true; providerId = result.data?.id; sent++; }
          }
        }
        if (!candidate.emailOnly && setting.push_notifications_enabled && pushConfigured) {
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
            group_id: group.id, round_id: candidate.round.id, notification_type: candidate.type,
            recipient_id: member.user_id, provider_id: providerId,
          });
        }
      }
    }
  }
  return NextResponse.json({ ok: true, sent, dryRun, roundsStarted, emailConfigured: Boolean(resend), pushConfigured });
}
