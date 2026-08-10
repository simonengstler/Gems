import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

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
  const { groupId } = await request.json() as { groupId?: string };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!token || !groupId) return NextResponse.json({ error: "Missing authentication or circle." }, { status: 400 });
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Notification diagnostics are not configured." }, { status: 503 });
  if (!apiKey || !from) return NextResponse.json({ error: "Email delivery is not configured yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL to Vercel Production, then redeploy." }, { status: 503 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user?.email) return NextResponse.json({ error: "Your signed-in email address could not be verified." }, { status: 401 });

  const [{ data: membership }, { data: group }, { data: settings }] = await Promise.all([
    admin.from("group_members").select("role,status").eq("group_id", groupId).eq("user_id", auth.user.id).maybeSingle(),
    admin.from("groups").select("name").eq("id", groupId).maybeSingle(),
    admin.from("group_settings").select("email_notifications_enabled").eq("group_id", groupId).maybeSingle(),
  ]);
  if (membership?.role !== "admin" || membership.status !== "approved") return NextResponse.json({ error: "Only an approved circle admin can send a test email." }, { status: 403 });
  if (!settings?.email_notifications_enabled) return NextResponse.json({ error: "Turn on the Email notifications master switch before sending a test." }, { status: 409 });

  const groupName = escapeHtml(group?.name || "your circle");
  const result = await new Resend(apiKey).emails.send({
    from,
    to: auth.user.email,
    subject: `Gems: email notifications are ready for ${group?.name || "your circle"}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="color:#174f3d">💎 Gems</h1><h2>Email notifications are working</h2><p>This is a test for <strong>${groupName}</strong>.</p><p>Real email alerts are sent for enabled round events when the scheduled notification check runs.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://gems-music.com"}">Open Gems</a></p></div>`,
  });
  if (result.error) return NextResponse.json({ error: result.error.message || "Resend could not deliver the test email." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
