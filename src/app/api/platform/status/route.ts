import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const RESEND_DAILY_LIMIT = 100;
const RESEND_MONTHLY_LIMIT = 3_000;

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Platform diagnostics are not configured." }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!platformAdmin) {
    return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  }

  const count = async (table: string) => {
    const { count: result, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return result || 0;
  };
  const deliveredEmailCount = async (since: string) => {
    const { count: result, error } = await admin
      .from("notification_log")
      .select("*", { count: "exact", head: true })
      .not("provider_id", "is", null)
      .gte("sent_at", since);
    if (error) throw error;
    return result || 0;
  };

  try {
    const [
      users,
      groups,
      rounds,
      submissions,
      ratings,
      pushSubscriptions,
      emailsToday,
      emailsThisMonth,
    ] = await Promise.all([
      count("users"),
      count("groups"),
      count("rounds"),
      count("submissions"),
      count("ratings"),
      count("push_subscriptions"),
      deliveredEmailCount(startOfUtcDay()),
      deliveredEmailCount(startOfUtcMonth()),
    ]);

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      environment: {
        appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
        supabaseHost: new URL(supabaseUrl).hostname,
      },
      resend: {
        configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
        senderConfigured: Boolean(process.env.RESEND_FROM_EMAIL),
        today: emailsToday,
        dailyLimit: RESEND_DAILY_LIMIT,
        dailyRemaining: Math.max(0, RESEND_DAILY_LIMIT - emailsToday),
        month: emailsThisMonth,
        monthlyLimit: RESEND_MONTHLY_LIMIT,
        monthlyRemaining: Math.max(0, RESEND_MONTHLY_LIMIT - emailsThisMonth),
        measurement: "Gems delivery log",
      },
      usage: {
        users,
        groups,
        rounds,
        submissions,
        ratings,
        pushSubscriptions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load platform usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
