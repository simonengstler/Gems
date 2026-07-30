"use client";

import {
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Flame,
  Gem,
  History,
  House,
  LoaderCircle,
  LogOut,
  Music2,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Profile = { id: string; nickname: string; streak: number };
type Group = {
  id: string;
  name: string;
  rules: string | null;
  created_by: string;
  created_at: string;
  archived_at?: string | null;
};
type Member = {
  id: string;
  user_id: string;
  role: "admin" | "member";
  status: "pending" | "approved" | "rejected";
  users: Profile | null;
};
type Round = {
  id: string;
  group_id: string;
  round_number: number;
  starts_at: string;
  submission_ends_at: string;
  rating_ends_at: string;
};
type Submission = {
  id: string;
  group_id: string;
  round_id: string;
  user_id: string;
  song_url: string;
  title?: string | null;
  artist?: string | null;
  thumbnail_url?: string | null;
  provider?: "spotify" | "youtube" | null;
  users?: Profile | null;
};
type Rating = {
  id: string;
  group_id: string;
  round_id: string;
  submission_id: string;
  user_id: string;
  emoji: Emoji;
  points: number;
};
type Emoji = "🖤" | "❤️" | "👍" | "👌" | "🤔";
type PlatformStatus = {
  checkedAt: string;
  environment: { appUrl: string | null; supabaseHost: string };
  resend: {
    configured: boolean;
    senderConfigured: boolean;
    today: number;
    dailyLimit: number;
    dailyRemaining: number;
    month: number;
    monthlyLimit: number;
    monthlyRemaining: number;
    measurement: string;
  };
  usage: {
    users: number;
    groups: number;
    rounds: number;
    submissions: number;
    ratings: number;
    pushSubscriptions: number;
  };
};

const ratingOptions: { emoji: Emoji; points: number; label: string }[] = [
  { emoji: "🖤", points: 3, label: "New to me, and I love it" },
  { emoji: "❤️", points: 2, label: "I know it, and I love it" },
  { emoji: "👍", points: 1, label: "Good — adding it" },
  { emoji: "👌", points: 0, label: "Decent, not quite my taste" },
  { emoji: "🤔", points: 0, label: "Interesting, not for my ears" },
];

const supabase = createClient();

function phaseOf(round: Round | null) {
  if (!round) return "empty" as const;
  const now = Date.now();
  if (now < new Date(round.submission_ends_at).getTime()) return "submit" as const;
  if (now < new Date(round.rating_ends_at).getTime()) return "rate" as const;
  return "reveal" as const;
}

function countdown(target?: string) {
  if (!target) return "";
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days) return `${days}d ${hours}h left`;
  if (hours) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function provider(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("spotify.com")) {
      const match = parsed.pathname.match(/\/(track|album)\/([a-zA-Z0-9]+)/);
      if (match) return { name: "Spotify", embed: `https://open.spotify.com/embed/${match[1]}/${match[2]}` };
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      if (id) return { name: "YouTube", embed: `https://www.youtube.com/embed/${id}` };
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      if (id) return { name: "YouTube", embed: `https://www.youtube.com/embed/${id}` };
    }
  } catch {}
  return null;
}

function Logo({ onClick }: { onClick?: () => void }) {
  const content = <>
    <span className="brand-mark"><Gem size={20} strokeWidth={2.4} /></span>
    <span>Gems</span>
  </>;
  return (
    onClick
      ? <button className="brand brand-button" onClick={onClick} aria-label="Open Gems home">{content}</button>
      : <div className="brand">{content}</div>
  );
}

function ProgressRing({ value, total, label }: { value: number; total: number; label: string }) {
  const percentage = total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : 0;
  return (
    <div className="progress-ring" role="progressbar" aria-label={`${value} of ${total} ${label}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="progress-track" cx="22" cy="22" r="18" />
        <circle className="progress-fill" cx="22" cy="22" r="18" pathLength="100" strokeDasharray={`${percentage} 100`} />
      </svg>
      <strong>{value}/{total}</strong>
      <small>{label}</small>
    </div>
  );
}

function Notice({ message, clear }: { message: string; clear: () => void }) {
  return (
    <div className="notice" role="status">
      <span>{message}</span>
      <button onClick={clear} aria-label="Dismiss"><X size={15} /></button>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const nickname = String(data.get("nickname") || "").trim();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}`,
        });
        if (error) throw error;
        setMessage("Password reset link sent. Check your inbox.");
      } else if (mode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname } },
        });
        if (error) throw error;
        if (!result.user) throw new Error("Account could not be created.");
        setMessage(result.session ? "Welcome to Gems." : "Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Logo />
        <div className="story-copy">
          <span className="eyebrow"><Sparkles size={14} /> Your best finds, together</span>
          <h1>Trade songs.<br />Find <em>gems.</em></h1>
          <p>A private listening ritual for the people whose taste you trust. One song each. A shared rhythm. No algorithms.</p>
        </div>
        <div className="cycle-preview">
          <div><span>01</span><strong>Share</strong><small>Choose privately</small></div>
          <i />
          <div><span>02</span><strong>Listen</strong><small>React together</small></div>
          <i />
          <div><span>03</span><strong>Reveal</strong><small>Forever saved</small></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="mobile-logo"><Logo /></span>
          <p className="kicker">{mode === "signup" ? "Start a listening circle" : mode === "reset" ? "Find your way back" : "Welcome back"}</p>
          <h2>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to Gems"}</h2>
          <p className="muted">{mode === "signup" ? "Choose carefully — your nickname stays with you." : "Your next discovery is waiting."}</p>
          <form onSubmit={submit} className="form-stack">
            {mode === "signup" && (
              <label>Nickname<input name="nickname" minLength={2} maxLength={32} required placeholder="e.g. velvetears" /></label>
            )}
            <label>Email<input name="email" type="email" required placeholder="you@example.com" /></label>
            {mode !== "reset" && (
              <label>Password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></label>
            )}
            {mode === "login" && <button type="button" className="text-button align-right" onClick={() => setMode("reset")}>Forgot password?</button>}
            <button className="primary-button" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
              {!busy && <ChevronRight size={17} />}
            </button>
          </form>
          {message && <p className="form-message">{message}</p>}
          <div className="auth-switch">
            {mode === "login" ? <>New here? <button onClick={() => setMode("signup")}>Create an account</button></> :
              <>Already have an account? <button onClick={() => setMode("login")}>Sign in</button></>}
          </div>
        </div>
      </section>
    </main>
  );
}

function GroupSetup({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(() => {
    if (typeof window === "undefined") return "";
    const result = sessionStorage.getItem("gems-invite-result") || "";
    sessionStorage.removeItem("gems-invite-result");
    return result;
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      if (tab === "create") {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("groups").insert({
          name: String(data.get("name") || "").trim(),
          rules: String(data.get("rules") || "").trim() || null,
          created_by: userData.user!.id,
        });
        if (error) throw error;
        onDone();
      } else {
        const { error } = await supabase.rpc("request_to_join_group", {
          exact_group_name: String(data.get("name") || "").trim(),
        });
        if (error) throw error;
        setMessage("Request sent. The group admin will let you in.");
        onDone();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <span className="gem-orbit"><Gem size={30} /></span>
        <p className="kicker">Find your people</p>
        <h2>Start sharing gems</h2>
        <p className="muted">Create a new listening circle or join one by its exact name.</p>
        <div className="tabs">
          <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><Plus size={16} /> Create</button>
          <button className={tab === "join" ? "active" : ""} onClick={() => setTab("join")}><Users size={16} /> Join</button>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>Group name<input name="name" required minLength={2} maxLength={80} placeholder={tab === "create" ? "Sunday Selects" : "Enter the exact group name"} /></label>
          {tab === "create" && <label>House rules <span>(optional)</span><textarea name="rules" maxLength={5000} placeholder="No repeats. No guilty pleasures. Surprise us." /></label>}
          <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : tab === "create" ? <Gem size={17} /> : <Users size={17} />}{tab === "create" ? "Create group" : "Request to join"}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  );
}

function UserPanel({ profile, close }: { profile: Profile; close: () => void }) {
  const [viewedProfile, setViewedProfile] = useState(profile);
  const [stats, setStats] = useState<Record<Emoji, number>>({ "🖤": 0, "❤️": 0, "👍": 0, "👌": 0, "🤔": 0 });
  const [summary, setSummary] = useState({ gems: 0, ratings: 0, points: 0, bestScore: 0 });
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  useEffect(() => {
    async function loadStats() {
      setStats({ "🖤": 0, "❤️": 0, "👍": 0, "👌": 0, "🤔": 0 });
      setSummary({ gems: 0, ratings: 0, points: 0, bestScore: 0 });
      const { data: songs } = await supabase.from("submissions").select("id").eq("user_id", viewedProfile.id);
      const ids = (songs || []).map((song) => song.id);
      const { data } = ids.length
        ? await supabase.from("ratings").select("emoji,points,submission_id").in("submission_id", ids)
        : { data: [] };
      const { count: ratingsGiven } = await supabase.from("ratings").select("id", { count: "exact", head: true }).eq("user_id", viewedProfile.id);
      const next: Record<Emoji, number> = { "🖤": 0, "❤️": 0, "👍": 0, "👌": 0, "🤔": 0 };
      for (const rating of data || []) next[rating.emoji as Emoji] += 1;
      setStats(next);
      const bySong = new Map<string, number>();
      for (const rating of data || []) bySong.set(rating.submission_id, (bySong.get(rating.submission_id) || 0) + rating.points);
      setSummary({
        gems: ids.length,
        ratings: ratingsGiven || 0,
        points: (data || []).reduce((sum, rating) => sum + rating.points, 0),
        bestScore: Math.max(0, ...bySong.values()),
      });
    }
    void loadStats();
  }, [viewedProfile.id]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") || "");
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : "Password updated successfully.");
    if (!error) event.currentTarget.reset();
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    const { data, error } = await supabase.rpc("search_users", { search_term: query.trim() });
    if (error) setMessage(error.message); else setResults((data || []) as Profile[]);
  }

  async function enablePush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return setMessage("Push keys are not configured yet. Add the VAPID keys from .env.example.");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setMessage("This browser does not support web push.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setMessage("Notification permission was not granted.");
    const registration = await navigator.serviceWorker.ready;
    const padding = "=".repeat((4 - publicKey.length % 4) % 4);
    const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
    const key = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token || ""}` },
      body: JSON.stringify(subscription),
    });
    setMessage(response.ok ? "Push notifications enabled on this device." : "Could not save this device.");
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="profile-modal">
        <button className="modal-close" onClick={close} aria-label="Close"><X size={18} /></button>
        <div className="profile-head"><span className="large-avatar">{viewedProfile.nickname.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">{viewedProfile.id === profile.id ? "Your profile" : "Listener profile"}</span><h2>{viewedProfile.nickname}</h2><p><Flame size={15} /> {viewedProfile.streak} round streak</p></div></div>
        <div className="profile-grid">
          <article>
            <span className="eyebrow">Reactions received</span>
            <h3>{viewedProfile.id === profile.id ? "Your gems, by feeling" : "Their gems, by feeling"}</h3>
            <div className="reaction-stats">{ratingOptions.map((item) => <div key={item.emoji}><span>{item.emoji}</span><strong>{stats[item.emoji]}</strong><small>{item.label}</small></div>)}</div>
          </article>
          {viewedProfile.id === profile.id && <article>
            <span className="eyebrow">Security</span>
            <h3>Change password</h3>
            <form onSubmit={changePassword} className="form-stack"><label>New password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></label><button className="primary-button">Update password</button></form>
            <button className="push-button" onClick={enablePush}>Enable browser notifications</button>
          </article>}
        </div>
        <div className="profile-summary"><div><strong>{summary.gems}</strong><small>gems shared</small></div><div><strong>{summary.ratings}</strong><small>ratings given</small></div><div><strong>{summary.points}</strong><small>points earned</small></div><div><strong>{summary.bestScore}</strong><small>best gem score</small></div></div>
        <article className="people-search">
          <span className="eyebrow">Community</span>
          <h3>Find a listener</h3>
          <form onSubmit={search}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by nickname" /><button>Search</button></form>
          {results.length > 0 && <div className="search-results">{results.map((user) => <button type="button" key={user.id} onClick={() => setViewedProfile(user)}><span className="avatar">{user.nickname.slice(0, 1).toUpperCase()}</span><strong>{user.nickname}</strong><small><Flame size={12} /> {user.streak} streak</small><span>View profile</span></button>)}</div>}
        </article>
        {message && <p className="form-message">{message}</p>}
      </section>
    </div>
  );
}

function AdminPanel({ group, members, rounds, submissions, close, refresh, notify }: {
  group: Group; members: Member[]; rounds: Round[]; submissions: Submission[];
  close: () => void; refresh: () => void; notify: (message: string) => void;
}) {
  const [settings, setSettings] = useState({
    email_notifications_enabled: false,
    round_started_email: true,
    rating_started_email: true,
    streak_warning_email: true,
    auto_start_rounds: false,
    push_notifications_enabled: true,
    submission_interval_days: 5,
    rating_interval_days: 7,
  });
  const [inviteUrl, setInviteUrl] = useState("");
  const [rules, setRules] = useState(group.rules || "");

  useEffect(() => {
    supabase.from("group_settings").select("*").eq("group_id", group.id).single()
      .then(({ data }) => { if (data) setSettings(data); });
  }, [group.id]);

  async function toggle(key: "email_notifications_enabled" | "round_started_email" | "rating_started_email" | "streak_warning_email" | "auto_start_rounds" | "push_notifications_enabled") {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    const { error } = await supabase.from("group_settings").update({ [key]: next[key] }).eq("group_id", group.id);
    if (error) notify(error.message);
  }

  async function updateInterval(key: "submission_interval_days" | "rating_interval_days", value: number) {
    const nextValue = Math.max(1, Math.min(14, value));
    setSettings((current) => ({ ...current, [key]: nextValue }));
    const { error } = await supabase.from("group_settings").update({ [key]: nextValue }).eq("group_id", group.id);
    notify(error ? error.message : "Round intervals updated for future rounds.");
  }

  async function createInvite() {
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("group_invitations").insert({
      group_id: group.id, created_by: auth.user!.id,
    }).select("token").single();
    if (error) return notify(error.message);
    const url = `${location.origin}/?invite=${data.token}`;
    setInviteUrl(url);
    await navigator.clipboard.writeText(url);
    notify("Invitation copied. It expires in 14 days.");
  }

  async function changeMember(member: Member, action: "promote" | "remove") {
    const result = action === "promote"
      ? await supabase.from("group_members").update({ role: "admin" }).eq("id", member.id)
      : await supabase.from("group_members").delete().eq("id", member.id);
    if (result.error) notify(result.error.message);
    else { notify(action === "promote" ? "Member promoted." : "Member removed."); refresh(); }
  }

  async function saveRules() {
    const { error } = await supabase.from("groups").update({ rules: rules.trim() || null }).eq("id", group.id);
    if (error) notify(error.message); else { notify("Circle rules updated."); refresh(); }
  }

  async function archiveGroup() {
    if (!confirm("Archive this circle? Its history remains in the database.")) return;
    const { error } = await supabase.from("groups").update({ archived_at: new Date().toISOString() }).eq("id", group.id);
    if (error) notify(error.message); else { notify("Circle archived."); close(); location.reload(); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="profile-modal admin-modal">
        <button className="modal-close" onClick={close}><X size={18} /></button>
        <div className="profile-head"><span className="large-avatar"><ShieldCheck /></span><div><span className="eyebrow">Circle administration</span><h2>{group.name}</h2><p>{members.filter((m) => m.status === "approved").length}/8 members · {rounds.length} rounds</p></div></div>
        <div className="admin-grid">
          <article>
            <span className="eyebrow">Automation</span><h3>Cost-safe controls</h3>
            {([
              ["email_notifications_enabled", "Email notifications", "Master switch — keep off in development"],
              ["round_started_email", "Round started email", "Prompt the circle to submit"],
              ["rating_started_email", "Rating unlocked email", "Announce the listening phase"],
              ["streak_warning_email", "Streak warning email", "Warn 12 hours before closing"],
              ["push_notifications_enabled", "Browser push", "Free delivery to opted-in devices"],
              ["auto_start_rounds", "Automatic new rounds", "Begin again after the reveal"],
            ] as const).map(([key, title, description]) => (
              <label className="setting-row" key={key}><div><strong>{title}</strong><small>{description}</small></div><input type="checkbox" checked={settings[key]} onChange={() => toggle(key)} /></label>
            ))}
          </article>
          <article>
            <span className="eyebrow">Invitations</span><h3>Bring people in</h3>
            <p className="admin-copy">Private links expire after 14 days. New members still require approval.</p>
            <button className="primary-button" onClick={createInvite}><Copy size={15} /> Copy invitation</button>
            {inviteUrl && <input className="invite-output" value={inviteUrl} readOnly />}
            <div className="usage-summary"><div><strong>{members.length}</strong><small>members</small></div><div><strong>{rounds.length}</strong><small>rounds</small></div><div><strong>{submissions.length}</strong><small>gems</small></div></div>
            <div className="interval-settings">
              <span className="eyebrow">Future rounds</span><h3>Listening rhythm</h3>
              <p className="admin-copy">Choose how long each interval lasts. Current-round deadlines stay unchanged.</p>
              <label>Choosing interval<input type="number" min={1} max={14} value={settings.submission_interval_days} onChange={(event) => updateInterval("submission_interval_days", Number(event.target.value))} /><small>days</small></label>
              <label>Rating interval<input type="number" min={1} max={14} value={settings.rating_interval_days} onChange={(event) => updateInterval("rating_interval_days", Number(event.target.value))} /><small>days</small></label>
            </div>
          </article>
        </div>
        <article className="member-admin">
          <span className="eyebrow">Membership</span><h3>People in this circle</h3>
          {members.filter((member) => member.status === "approved").map((member) => <div key={member.id}><span className="avatar">{member.users?.nickname?.slice(0,1)}</span><strong>{member.users?.nickname}</strong><small>{member.role}</small>{member.role !== "admin" && <><button onClick={() => changeMember(member, "promote")}>Make admin</button><button className="danger-link" onClick={() => changeMember(member, "remove")}>Remove</button></>}</div>)}
        </article>
        <article className="member-admin">
          <span className="eyebrow">Circle details</span><h3>Rules and lifecycle</h3>
          <textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={5000} placeholder="Write the house rules…" />
          <div className="admin-actions"><button className="primary-button" onClick={saveRules}>Save rules</button><button className="archive-button" onClick={archiveGroup}>Archive circle</button></div>
        </article>
      </section>
    </div>
  );
}

function PlatformAdminPanel({ close }: { close: () => void }) {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const limits = [
    ["Supabase", "500 MB database", "50k MAU · 5 GB egress · 1 GB files · 2 projects", "https://supabase.com/pricing"],
    ["Supabase Realtime", "2M messages/month", "200 peak connections · 500k Edge calls", "https://supabase.com/pricing"],
    ["Resend", "3,000 emails/month", "100/day · master switch is off", "https://resend.com/pricing"],
    ["YouTube", "No API key in core flow", "Public embeds and oEmbed metadata", "https://developers.google.com/youtube/v3"],
    ["Spotify", "No paid API in core flow", "Public embeds and oEmbed metadata", "https://developer.spotify.com/documentation/web-api/concepts/quota-modes"],
    ["Vercel Hobby", "Production host", "Recheck current limits before scaling", "https://vercel.com/pricing"],
  ];
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const response = await fetch("/api/platform/status", {
        headers: { authorization: `Bearer ${data.session?.access_token || ""}` },
      });
      const result = await response.json() as PlatformStatus | { error?: string };
      if (!active) return;
      if (!response.ok) {
        setStatusError("error" in result ? result.error || "Could not load usage." : "Could not load usage.");
      } else {
        setStatus(result as PlatformStatus);
      }
    }).catch(() => active && setStatusError("Could not load platform usage."));
    return () => { active = false; };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="profile-modal admin-modal">
        <button className="modal-close" onClick={close} aria-label="Close"><X size={18} /></button>
        <div className="profile-head"><span className="large-avatar"><Settings2 /></span><div><span className="eyebrow">Platform operations</span><h2>Developer console</h2><p>Visible only to platform administrators</p></div></div>
        <article className="limits-card">
          <span className="eyebrow">Live application counters</span><h3>Production readiness</h3>
          {!status && !statusError && <p className="status-loading"><LoaderCircle className="spin" size={15} /> Reading production usage…</p>}
          {statusError && <p className="status-error">{statusError}</p>}
          {status && <>
            <div className="readiness-row">
              <div><span className={`readiness-dot ${status.resend.configured ? "ready" : ""}`} /><strong>Resend email</strong><small>{status.resend.configured ? "API key and sender configured" : "Missing API key or sender address"}</small></div>
              <div><strong>{status.resend.dailyRemaining}</strong><small>of {status.resend.dailyLimit} emails left today</small></div>
              <div><strong>{status.resend.monthlyRemaining}</strong><small>of {status.resend.monthlyLimit} emails left this month</small></div>
            </div>
            <p className="meter-note">Counts come from Gems’ successful-delivery log, not Resend billing. Checked {new Date(status.checkedAt).toLocaleString()}.</p>
            <div className="usage-metrics">
              {([
                ["Users", status.usage.users],
                ["Circles", status.usage.groups],
                ["Rounds", status.usage.rounds],
                ["Gems", status.usage.submissions],
                ["Ratings", status.usage.ratings],
                ["Push devices", status.usage.pushSubscriptions],
              ] as const).map(([label, value]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}
            </div>
            <p className="environment-note">Backend: {status.environment.supabaseHost} · App: {status.environment.appUrl || "not configured"}</p>
          </>}
        </article>
        <article className="limits-card">
          <span className="eyebrow">Free-tier guardrails · reviewed July 2026</span><h3>Service limits</h3>
          <div className="limits-grid">{limits.map(([service, value, note, href]) => <a key={service} href={href} target="_blank" rel="noreferrer"><strong>{service}</strong><b>{value}</b><small>{note}</small><ChevronRight size={14} /></a>)}</div>
          <p>Reference values—not live billing meters. Follow a card to confirm the provider’s current terms.</p>
        </article>
      </section>
    </div>
  );
}

function HomePage({ start }: { start: () => void }) {
  return (
    <section className="home-page">
      <span className="eyebrow"><Sparkles size={14} /> Music discovery with people, not feeds</span>
      <h1>Turn the songs you love into a shared ritual.</h1>
      <p>Gems gives a small, private circle room to choose intentionally, listen closely, and build a lasting soundtrack together—without rankings appearing before everyone has had their say.</p>
      <div className="home-principles">
        <article><span>01</span><h2>Choose privately</h2><p>Each person brings one musical find. The surprise stays sealed until the listening interval begins.</p></article>
        <article><span>02</span><h2>Listen together</h2><p>Open every gem, react with a shared language, and give each choice genuine attention.</p></article>
        <article><span>03</span><h2>Keep what matters</h2><p>Reveal the circle’s favorites and preserve every round as a collective musical memory.</p></article>
      </div>
      <button className="primary-button compact" onClick={start}><Gem size={16} /> Go to the current round</button>
    </section>
  );
}

function EmptyRound({ isAdmin, members, start }: { isAdmin: boolean; members: Member[]; start: () => void }) {
  return (
    <section className="empty-state">
      <div className="empty-gem"><Gem size={38} /></div>
      <span className="eyebrow">A fresh circle</span>
      <h2>Waiting for the first gems…</h2>
      <p>{members.length < 2 ? "Invite at least one friend, then your first listening ritual can begin." : "Your circle is ready. Start the first round when everyone is listening."}</p>
      <div className="member-bubbles">{members.map((member) => <span key={member.id} title={member.users?.nickname}>{member.users?.nickname?.slice(0, 1).toUpperCase()}</span>)}</div>
      {isAdmin && <button className="primary-button compact" disabled={members.length < 2} onClick={start}><Sparkles size={17} /> Start round</button>}
      {!isAdmin && <small>The group admin will start the round.</small>}
    </section>
  );
}

function SongCard({ submission, rating, onRate, isOwn }: { submission: Submission; rating?: Emoji; onRate: (emoji: Emoji) => void; isOwn: boolean }) {
  const media = provider(submission.song_url);
  const [opened, setOpened] = useState(false);
  return (
    <article className="song-card">
      <div className="song-heading">
        <div className="music-icon"><Music2 size={19} /></div>
        <div><strong>{submission.title || `${submission.users?.nickname || "A group member"}’s gem`}</strong><small>{submission.artist || media?.name || "Music link"} · chosen by {submission.users?.nickname}</small></div>
        {rating && <span className="rated-mark"><Check size={13} /> Rated</span>}
      </div>
      {!opened ? <button className="listen-gate" onClick={() => setOpened(true)}><Play size={22} fill="currentColor" /><span><strong>Open player to listen</strong><small>Reactions unlock after this click</small></span></button> :
        media ? <iframe src={media.embed} title={`${media.name} player`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> :
          <a className="external-song" href={submission.song_url} target="_blank" rel="noreferrer">Open song <ChevronRight size={15} /></a>}
      <a className="source-link" href={submission.song_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
        Open the original on {media?.name || "its music site"} <ChevronRight size={13} />
      </a>
      {isOwn ? <p className="own-submission-note">This is your gem — listen, but leave the reactions to your circle.</p> : <div className="rating-row">
        {ratingOptions.map((option) => (
          <button key={option.emoji} disabled={!opened} className={rating === option.emoji ? "selected" : ""} onClick={() => onRate(option.emoji)} title={opened ? `${option.label} · ${option.points} points` : "Open the song before rating"}>
            <span>{option.emoji}</span><small>{option.points}pt</small>
          </button>
        ))}
      </div>}
      {!isOwn && !opened && <small className="rating-lock-note">Open this song before choosing a reaction.</small>}
    </article>
  );
}

function Dashboard({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [intervals, setIntervals] = useState({ submission: 5, rating: 7 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showGroupSetup, setShowGroupSetup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPlatformAdmin, setShowPlatformAdmin] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [view, setView] = useState<"home" | "round" | "history">("round");
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loadGroups = useCallback(async () => {
    const { data: me } = await supabase.from("users").select("*").eq("id", session.user.id).maybeSingle();
    setProfile(me);
    const { data: memberships } = await supabase.from("group_members").select("group_id,status").eq("user_id", session.user.id);
    const approvedIds = (memberships || []).filter((m) => m.status === "approved").map((m) => m.group_id);
    if (approvedIds.length) {
      const { data } = await supabase.from("groups").select("*").in("id", approvedIds).is("archived_at", null).order("created_at");
      setGroups(data || []);
      setSelectedId((current) => current || data?.[0]?.id || "");
    } else {
      setGroups([]);
    }
    setLoading(false);
  }, [session.user.id]);

  const loadGroup = useCallback(async () => {
    if (!selectedId) return;
    const [{ data: memberData }, { data: roundData }, { data: settingData }] = await Promise.all([
      supabase.from("group_members").select("*,users!group_members_user_id_fkey(id,nickname,streak)").eq("group_id", selectedId).order("created_at"),
      supabase.from("rounds").select("*").eq("group_id", selectedId).order("round_number", { ascending: false }),
      supabase.from("group_settings").select("submission_interval_days,rating_interval_days").eq("group_id", selectedId).maybeSingle(),
    ]);
    if (settingData) setIntervals({ submission: settingData.submission_interval_days, rating: settingData.rating_interval_days });
    setMembers((memberData || []) as Member[]);
    setRounds((roundData || []) as Round[]);
    const roundIds = (roundData || []).map((round) => round.id);
    if (roundIds.length) {
      const [{ data: submissionData }, { data: ratingData }] = await Promise.all([
        supabase.from("submissions").select("*").in("round_id", roundIds),
        supabase.from("ratings").select("*").in("round_id", roundIds),
      ]);
      const profiles = new Map(
        (memberData || []).map((member) => [
          member.user_id,
          member.users as unknown as Profile,
        ]),
      );
      setSubmissions(((submissionData || []) as Submission[]).map((submission) => ({
        ...submission,
        users: profiles.get(submission.user_id) || null,
      })));
      setRatings((ratingData || []) as Rating[]);
    } else {
      setSubmissions([]);
      setRatings([]);
    }
  }, [selectedId]);

  // Initial database synchronization is intentionally effect-driven.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => {
    supabase.from("platform_admins").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setIsPlatformAdmin(Boolean(data)));
  }, [session.user.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadGroup(); }, [loadGroup]);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60000);
    const channel = supabase.channel("gems-live")
      .on("postgres_changes", { event: "*", schema: "public" }, () => { loadGroups(); loadGroup(); })
      .subscribe();
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [loadGroup, loadGroups]);

  const group = groups.find((item) => item.id === selectedId);
  const approved = members.filter((member) => member.status === "approved");
  const pending = members.filter((member) => member.status === "pending");
  const myMembership = members.find((member) => member.user_id === session.user.id);
  const isAdmin = myMembership?.role === "admin";
  const currentRound = rounds[0] || null;
  const phase = phaseOf(currentRound);
  const currentSubmissions = submissions.filter((item) => item.round_id === currentRound?.id);
  const currentRatings = ratings.filter((item) => item.round_id === currentRound?.id);
  const eligibleRatingTotal = approved.reduce(
    (total, member) => total + currentSubmissions.filter((submission) => submission.user_id !== member.user_id).length,
    0,
  );
  const mySubmission = currentSubmissions.find((item) => item.user_id === session.user.id);
  const phaseTarget = phase === "submit" ? currentRound?.submission_ends_at : currentRound?.rating_ends_at;
  void tick;

  async function startRound() {
    if (!group) return;
    const previous = rounds[0];
    const starts = new Date();
    const submissionEnd = new Date(starts.getTime() + intervals.submission * 86400000);
    const ratingEnd = new Date(submissionEnd.getTime() + intervals.rating * 86400000);
    const { error } = await supabase.from("rounds").insert({
      group_id: group.id,
      round_number: (previous?.round_number || 0) + 1,
      starts_at: starts.toISOString(),
      submission_ends_at: submissionEnd.toISOString(),
      rating_ends_at: ratingEnd.toISOString(),
    });
    if (error) setNotice(error.message); else { setNotice("A new round has started."); loadGroup(); }
  }

  async function saveSubmission(event: FormEvent) {
    event.preventDefault();
    if (!currentRound || !provider(songUrl)) {
      setNotice("Paste a valid Spotify track/album or YouTube video/short link.");
      return;
    }
    let metadata: { title?: string; artist?: string; thumbnailUrl?: string; provider?: string } = {};
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(songUrl.trim())}`);
      if (response.ok) metadata = await response.json();
    } catch {}
    const payload = {
      group_id: selectedId,
      round_id: currentRound.id,
      user_id: session.user.id,
      song_url: songUrl.trim(),
      title: metadata.title || null,
      artist: metadata.artist || null,
      thumbnail_url: metadata.thumbnailUrl || null,
      provider: metadata.provider || null,
    };
    const { error } = await supabase.from("submissions").upsert(payload, { onConflict: "round_id,user_id" });
    if (error) setNotice(error.message); else { setNotice(mySubmission ? "Your gem was updated." : "Your gem is locked in."); loadGroup(); }
  }

  async function rate(submissionId: string, emoji: Emoji) {
    if (!currentRound) return;
    const submission = currentSubmissions.find((item) => item.id === submissionId);
    if (!submission || submission.user_id === session.user.id) {
      setNotice("You cannot rate your own submission.");
      return;
    }
    const existing = ratings.find((item) => item.submission_id === submissionId && item.user_id === session.user.id);
    setRatings((items) => existing
      ? items.map((item) => item.id === existing.id ? { ...item, emoji } : item)
      : [...items, {
          id: `optimistic-${submissionId}`,
          group_id: selectedId,
          round_id: currentRound.id,
          submission_id: submissionId,
          user_id: session.user.id,
          emoji,
          points: ratingOptions.find((item) => item.emoji === emoji)?.points || 0,
        }]);
    const { error } = await supabase.from("ratings").upsert({
      group_id: selectedId,
      round_id: currentRound.id,
      submission_id: submissionId,
      user_id: session.user.id,
      emoji,
    }, { onConflict: "submission_id,user_id" });
    if (error) { setNotice(error.message); loadGroup(); } else loadGroup();
  }

  async function endCurrentPhase() {
    if (!currentRound || !isAdmin) return;
    const allSubmitted = approved.length > 0 && currentSubmissions.length === approved.length;
    const expectedRatings = eligibleRatingTotal;
    const allRated = expectedRatings > 0 && currentRatings.length === expectedRatings;
    if (phase === "submit" && !allSubmitted) {
      setNotice("Every approved member must submit before the choosing interval can end.");
      return;
    }
    if (phase === "rate" && !allRated) {
      setNotice("Every required reaction must be complete before the rating interval can end.");
      return;
    }
    const nextPhase = phase === "submit" ? "rating" : "reveal";
    if (!confirm(`End the ${phase === "submit" ? "choosing" : "rating"} interval now and move the whole circle to ${nextPhase}?`)) return;
    const { error } = await supabase.rpc("complete_round_phase", { target_round_id: currentRound.id });
    if (error) setNotice(error.message);
    else {
      setNotice(phase === "submit" ? "Choosing complete. Rating is now open." : "Rating complete. The results are revealed.");
      await loadGroup();
    }
  }

  async function approve(member: Member, status: "approved" | "rejected") {
    const { error } = await supabase.from("group_members").update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? session.user.id : null,
    }).eq("id", member.id);
    if (error) setNotice(error.message); else loadGroup();
  }

  async function leaveGroup() {
    if (!group || !confirm(`Leave ${group.name}?`)) return;
    const { error } = await supabase.rpc("leave_group", { target_group_id: group.id });
    if (error) setNotice(error.message);
    else { setNotice("You left the circle."); setSelectedId(""); await loadGroups(); }
  }

  async function fastForward(days: number) {
    if (!currentRound) return;
    if (!confirm(`Move this circle's shared round forward by ${days} day${days === 1 ? "" : "s"}? This changes the live submission and rating deadlines for every member.`)) return;
    const shift = (iso: string) => new Date(new Date(iso).getTime() - days * 86400000).toISOString();
    const { error } = await supabase.from("rounds").update({
      starts_at: shift(currentRound.starts_at),
      submission_ends_at: shift(currentRound.submission_ends_at),
      rating_ends_at: shift(currentRound.rating_ends_at),
    }).eq("id", currentRound.id);
    if (error) setNotice(error.message); else { setNotice(`Time moved forward ${days} day${days === 1 ? "" : "s"}.`); loadGroup(); }
  }

  async function seedDummyData() {
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/dev/seed", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${data.session?.access_token || ""}`,
      },
      body: JSON.stringify({ groupId: selectedId }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) setNotice(result.error || "Could not create dummy data.");
    else {
      setNotice("Added 3 test listeners, songs, and ratings.");
      await loadGroup();
    }
  }

  if (loading) return <div className="full-loader"><Gem className="pulse" size={34} /><span>Polishing your gems…</span></div>;
  if (!profile) return <ProfileRecovery session={session} onDone={loadGroups} />;
  if (!groups.length) return (
    <div className="app-bg">
      <header className="topbar"><Logo /><div className="user-menu"><span>{profile.nickname}</span><button onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button></div></header>
      <GroupSetup onDone={loadGroups} />
    </div>
  );

  const leaderboard = currentSubmissions.map((submission) => ({
    ...submission,
    points: currentRatings.filter((rating) => rating.submission_id === submission.id).reduce((sum, rating) => sum + rating.points, 0),
    reactions: currentRatings.filter((rating) => rating.submission_id === submission.id),
  })).sort((a, b) => b.points - a.points);
  const myRatings = currentRatings.filter((rating) => rating.user_id === session.user.id);

  return (
    <div className="app-bg">
      <header className="topbar">
        <Logo onClick={() => setView("home")} />
        <nav>
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><House size={16} /> Home</button>
          <button className={view === "round" ? "active" : ""} onClick={() => setView("round")}><Gem size={16} /> Current round</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><History size={16} /> History</button>
        </nav>
        <div className="user-menu">
          <span className="avatar">{profile.nickname.slice(0, 1).toUpperCase()}</span>
          <span>{profile.nickname}</span>
          <span className="streak"><Flame size={15} /> {profile.streak}</span>
          <button onClick={() => setShowProfile(true)} aria-label="Open profile"><UserRound size={17} /></button>
          {isPlatformAdmin && <button onClick={() => setShowPlatformAdmin(true)} aria-label="Open developer console"><Settings2 size={17} /></button>}
          <button onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>
      {notice && <Notice message={notice} clear={() => setNotice("")} />}
      {showProfile && <UserPanel profile={profile} close={() => setShowProfile(false)} />}
      {showAdmin && group && <AdminPanel group={group} members={members} rounds={rounds} submissions={submissions} close={() => setShowAdmin(false)} refresh={() => { loadGroups(); loadGroup(); }} notify={setNotice} />}
      {showPlatformAdmin && <PlatformAdminPanel close={() => setShowPlatformAdmin(false)} />}
      {showGroupSetup && <div className="modal-backdrop"><div className="group-modal"><button className="modal-close" onClick={() => setShowGroupSetup(false)}><X size={18} /></button><GroupSetup onDone={() => { setShowGroupSetup(false); loadGroups(); }} /></div></div>}
      <main className="dashboard">
        <aside>
          <p className="sidebar-label">Your circles</p>
          {groups.map((item) => <button key={item.id} className={item.id === selectedId ? "group-link active" : "group-link"} onClick={() => setSelectedId(item.id)}><span>{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.id === selectedId ? `${approved.length} members` : "Listening circle"}</small></div></button>)}
          <button className="new-group" onClick={() => setShowGroupSetup(true)}><Plus size={16} /> New circle</button>
        </aside>
        <div className="main-column">
          {view === "home" && <HomePage start={() => setView("round")} />}
          {view !== "home" && <section className="group-hero">
            <div>
              <span className="eyebrow"><Gem size={13} /> Listening circle</span>
              <h1>{group?.name}</h1>
              {group?.rules && <p>“{group.rules}”</p>}
            </div>
            <div className="hero-meta">
              {currentRound && <span>Round {currentRound.round_number}</span>}
              <span><Users size={15} /> {approved.length}/8</span>
              <button onClick={leaveGroup} title="Leave circle"><LogOut size={16} /></button>
              {isAdmin && <button className="admin-entry" onClick={() => setShowAdmin(true)} title="Circle administration"><ShieldCheck size={17} /><span>Admin</span></button>}
              {isAdmin && <button onClick={() => setShowSettings(!showSettings)} title="Time Machine"><Settings2 size={17} /></button>}
            </div>
          </section>}

          {view === "round" && pending.length > 0 && isAdmin && (
            <section className="admin-card">
              <div><ShieldCheck size={19} /><div><strong>{pending.length} join request{pending.length > 1 ? "s" : ""}</strong><small>Your circle stays private until you approve.</small></div></div>
              {pending.map((member) => <div className="request-row" key={member.id}><span className="avatar">{member.users?.nickname?.slice(0, 1).toUpperCase()}</span><strong>{member.users?.nickname}</strong><button onClick={() => approve(member, "rejected")} className="ghost-button">Decline</button><button onClick={() => approve(member, "approved")} className="small-button">Approve</button></div>)}
            </section>
          )}

          {view === "round" && showSettings && isAdmin && (
            <section className="dev-card">
              <div><Settings2 size={18} /><div><strong>Time Machine</strong><small>Admin only · shift this circle’s live round forward</small></div></div>
              <div>{[1, 5, 12].map((days) => <button key={days} onClick={() => fastForward(days)}>+{days} day{days > 1 ? "s" : ""}</button>)}</div>
              {process.env.NODE_ENV === "development" && <button onClick={seedDummyData}>Add dummy data</button>}
            </section>
          )}

          {view === "round" && phase === "empty" && <EmptyRound isAdmin={isAdmin} members={approved} start={startRound} />}

          {view === "round" && phase !== "empty" && (
            <section className="round-status">
              <div className={`phase-step ${phase === "submit" ? "active" : "done"}`}><span>{phase === "submit" ? "1" : <Check size={15} />}</span><div><strong>Submit</strong><small>Choosing interval</small></div></div>
              <i />
              <div className={`phase-step ${phase === "rate" ? "active" : phase === "reveal" ? "done" : ""}`}><span>{phase === "reveal" ? <Check size={15} /> : "2"}</span><div><strong>Rate</strong><small>Listening interval</small></div></div>
              <i />
              <div className={`phase-step ${phase === "reveal" ? "active" : ""}`}><span>3</span><div><strong>Reveal</strong><small>When ratings close</small></div></div>
              {phase !== "reveal" && <div className="countdown"><Clock3 size={16} /><strong>{countdown(phaseTarget)}</strong><small>UTC countdown</small></div>}
            </section>
          )}

          {view === "round" && phase === "submit" && (
            <section className="content-card submit-card">
              <div className="section-title"><div><span className="eyebrow">Submission phase</span><h2>{mySubmission ? "Your gem is in." : "What’s your gem?"}</h2><p>{mySubmission ? "You can swap it anytime before the countdown ends." : "Share one track or album. Nobody sees what it is until rating begins."}</p></div><ProgressRing value={currentSubmissions.length} total={approved.length} label="submitted" /></div>
              <form onSubmit={saveSubmission} className="song-form">
                <Music2 size={18} />
                <input value={songUrl} onChange={(e) => setSongUrl(e.target.value)} placeholder={mySubmission ? "Paste a new Spotify or YouTube link to swap" : "Paste a Spotify or YouTube link"} required />
                <button>{mySubmission ? "Swap gem" : "Submit gem"} <ChevronRight size={16} /></button>
              </form>
              <p className="provider-shortcuts">Need a gem? Browse <a href="https://open.spotify.com/" target="_blank" rel="noreferrer">Spotify</a> or <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">YouTube</a>, then paste the link above.</p>
              {mySubmission && <div className="locked-note"><Check size={16} /><span>Your current link is safely hidden from the group.</span></div>}
              <div className="member-progress">
                {approved.map((member) => {
                  const done = currentSubmissions.some((item) => item.user_id === member.user_id);
                  return <div key={member.id} className={done ? "done" : ""}><span>{member.users?.nickname?.slice(0, 1).toUpperCase()}</span><strong>{member.users?.nickname}</strong><small>{done ? "Gem secured" : "Choosing…"}</small>{done && <Check size={14} />}</div>;
                })}
              </div>
              {isAdmin && currentSubmissions.length === approved.length && approved.length > 0 && <div className="phase-complete-action"><div><Check size={18} /><span><strong>Every gem is in.</strong><small>You can open rating now instead of waiting for the countdown.</small></span></div><button className="primary-button compact" onClick={endCurrentPhase}>End choosing interval</button></div>}
            </section>
          )}

          {view === "round" && phase === "rate" && (
            <section className="rating-section">
              <div className="section-title"><div><span className="eyebrow">The gems are unlocked</span><h2>Listen with intention.</h2><p>Open every song before reacting. Nobody rates their own gem, and reactions remain changeable until time runs out.</p></div><ProgressRing value={currentRatings.length} total={eligibleRatingTotal} label="circle ratings" /></div>
              <div className="rating-legend">{ratingOptions.map((item) => <span key={item.emoji}><b>{item.emoji}</b>{item.points} pt · {item.label}</span>)}</div>
              <div className="song-grid">{currentSubmissions.map((submission) => <SongCard key={submission.id} submission={submission} rating={myRatings.find((rating) => rating.submission_id === submission.id)?.emoji} onRate={(emoji) => rate(submission.id, emoji)} isOwn={submission.user_id === session.user.id} />)}</div>
              {isAdmin && eligibleRatingTotal > 0 && currentRatings.length === eligibleRatingTotal && <div className="phase-complete-action"><div><Check size={18} /><span><strong>Every eligible reaction is in.</strong><small>You can reveal the results now instead of waiting for the countdown.</small></span></div><button className="primary-button compact" onClick={endCurrentPhase}>End rating interval</button></div>}
            </section>
          )}

          {view === "round" && phase === "reveal" && (
            <section className="reveal-card">
              <span className="eyebrow"><Sparkles size={14} /> Round {currentRound?.round_number} complete</span>
              <h2>The brightest gems</h2>
              <p>Every listen, every reaction, one shared soundtrack.</p>
              <div className="podium">
                {leaderboard.map((item, index) => <article key={item.id} className={index === 0 ? "winner" : ""}><span className="rank">{index + 1}</span><div className="cover"><Gem size={index === 0 ? 30 : 22} /></div><div><strong>{item.users?.nickname}’s gem</strong><a href={item.song_url} target="_blank" rel="noreferrer">{provider(item.song_url)?.name || "Open song"} <ChevronRight size={13} /></a><span className="reactions">{item.reactions.map((reaction) => <b key={reaction.id}>{reaction.emoji}</b>)}</span></div><strong className="score">{item.points}<small>pts</small></strong></article>)}
              </div>
              {isAdmin && <button className="primary-button compact" onClick={startRound}><Sparkles size={16} /> Start the next round</button>}
            </section>
          )}

          {view === "history" && <section id="history" className="history-section history-page">
            <div className="section-title"><div><span className="eyebrow">The vault</span><h2>Listening history</h2></div></div>
            {rounds.filter((round) => phaseOf(round) === "reveal").length === 0 ? <div className="history-empty"><History size={24} /><span>Completed rounds will live here forever.</span></div> :
              rounds.filter((round) => phaseOf(round) === "reveal").map((round) => {
                const songs = submissions.filter((item) => item.round_id === round.id).map((song) => ({
                  ...song,
                  reactions: ratings.filter((rating) => rating.submission_id === song.id),
                  score: ratings.filter((rating) => rating.submission_id === song.id).reduce((sum, rating) => sum + rating.points, 0),
                })).sort((a, b) => b.score - a.score);
                return <div className="history-entry" key={round.id}><button className="history-row" onClick={() => setExpandedRound(expandedRound === round.id ? null : round.id)}><span><Gem size={17} /></span><div><strong>Round {round.round_number}</strong><small>{new Date(round.starts_at).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</small></div><div>{songs.length} gems</div><ChevronRight className={expandedRound === round.id ? "rotate" : ""} size={17} /></button>{expandedRound === round.id && <div className="history-detail">{songs.map((song, index) => <div key={song.id}><span>#{index + 1}</span>{song.thumbnail_url ? <span className="history-art" role="img" aria-label="" style={{ backgroundImage: `url("${song.thumbnail_url}")` }} /> : <span className="mini-cover"><Music2 size={15} /></span>}<div><strong>{song.title || `${song.users?.nickname}'s gem`}</strong><small>{song.artist || song.users?.nickname}</small></div><span className="history-reactions">{song.reactions.map((reaction) => reaction.emoji).join(" ")}</span><b>{song.score} pts</b><a href={song.song_url} target="_blank" rel="noreferrer"><ChevronRight size={15} /></a></div>)}</div>}</div>;
              })}
          </section>}
        </div>
      </main>
      <nav className="mobile-nav">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><House size={18} /><span>Home</span></button>
        <button className={view === "round" ? "active" : ""} onClick={() => setView("round")}><Gem size={18} /><span>Round</span></button>
        <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><History size={18} /><span>History</span></button>
        <button onClick={() => setShowGroupSetup(true)}><Plus size={18} /><span>Circle</span></button>
        <button onClick={() => setShowProfile(true)}><UserRound size={18} /><span>Profile</span></button>
        {isAdmin && <button onClick={() => setShowAdmin(true)}><ShieldCheck size={18} /><span>Admin</span></button>}
      </nav>
    </div>
  );
}

function ProfileRecovery({ session, onDone }: { session: Session; onDone: () => void }) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nickname = String(new FormData(event.currentTarget).get("nickname") || "").trim();
    const { error } = await supabase.from("users").insert({ id: session.user.id, nickname });
    if (error) setMessage(error.message); else onDone();
  }
  return <div className="app-bg"><div className="setup-wrap"><form onSubmit={submit} className="setup-card form-stack"><Logo /><h2>Choose your nickname</h2><p className="muted">This is how your circle will know you. It cannot be changed later.</p><label>Nickname<input name="nickname" minLength={2} maxLength={32} required /></label><button className="primary-button">Finish setup</button>{message && <p className="form-message">{message}</p>}</form></div></div>;
}

export function GemsApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    const token = new URLSearchParams(location.search).get("invite");
    if (!token) return;
    supabase.rpc("join_group_by_invite", { invite_token: token }).then(({ error }) => {
      sessionStorage.setItem("gems-invite-result", error ? error.message : "Invitation accepted. The circle admin can now approve you.");
      history.replaceState({}, "", location.pathname);
      location.reload();
    });
  }, [session]);
  if (session === undefined) return <div className="full-loader"><Gem className="pulse" size={34} /></div>;
  return session ? <Dashboard session={session} /> : <AuthScreen />;
}
