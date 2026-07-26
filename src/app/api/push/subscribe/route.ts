import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const subscription = await request.json() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  const { error: saveError } = await admin.from("push_subscriptions").upsert({
    user_id: data.user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }, { onConflict: "user_id,endpoint" });
  return NextResponse.json(saveError ? { error: saveError.message } : { ok: true }, { status: saveError ? 500 : 200 });
}
