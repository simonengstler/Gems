"use client";

import {
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Gem,
  History,
  LoaderCircle,
  LogOut,
  Music2,
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

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark"><Gem size={20} strokeWidth={2.4} /></span>
      <span>Gems</span>
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
        const { data: result, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!result.user) throw new Error("Account could not be created.");
        if (result.session) {
          const { error: profileError } = await supabase
            .from("users")
            .insert({ id: result.user.id, nickname });
          if (profileError) throw profileError;
        }
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
          <p>A private listening ritual for the people whose taste you trust. One song each. Twelve days. No algorithms.</p>
        </div>
        <div className="cycle-preview">
          <div><span>01</span><strong>Share</strong><small>Days 1–5</small></div>
          <i />
          <div><span>02</span><strong>Listen</strong><small>Days 6–12</small></div>
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
  const [message, setMessage] = useState("");

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
  const [stats, setStats] = useState<Record<Emoji, number>>({ "🖤": 0, "❤️": 0, "👍": 0, "👌": 0, "🤔": 0 });
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  useEffect(() => {
    async function loadStats() {
      const { data: songs } = await supabase.from("submissions").select("id").eq("user_id", profile.id);
      const ids = (songs || []).map((song) => song.id);
      if (!ids.length) return;
      const { data } = await supabase.from("ratings").select("emoji").in("submission_id", ids);
      const next: Record<Emoji, number> = { "🖤": 0, "❤️": 0, "👍": 0, "👌": 0, "🤔": 0 };
      for (const rating of data || []) next[rating.emoji as Emoji] += 1;
      setStats(next);
    }
    void loadStats();
  }, [profile.id]);

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

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="profile-modal">
        <button className="modal-close" onClick={close} aria-label="Close"><X size={18} /></button>
        <div className="profile-head"><span className="large-avatar">{profile.nickname.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">Your profile</span><h2>{profile.nickname}</h2><p><Flame size={15} /> {profile.streak} round streak</p></div></div>
        <div className="profile-grid">
          <article>
            <span className="eyebrow">Reactions received</span>
            <h3>Your gems, by feeling</h3>
            <div className="reaction-stats">{ratingOptions.map((item) => <div key={item.emoji}><span>{item.emoji}</span><strong>{stats[item.emoji]}</strong><small>{item.label}</small></div>)}</div>
          </article>
          <article>
            <span className="eyebrow">Security</span>
            <h3>Change password</h3>
            <form onSubmit={changePassword} className="form-stack"><label>New password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></label><button className="primary-button">Update password</button></form>
          </article>
        </div>
        <article className="people-search">
          <span className="eyebrow">Community</span>
          <h3>Find a listener</h3>
          <form onSubmit={search}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by nickname" /><button>Search</button></form>
          {results.length > 0 && <div className="search-results">{results.map((user) => <div key={user.id}><span className="avatar">{user.nickname.slice(0, 1).toUpperCase()}</span><strong>{user.nickname}</strong><small><Flame size={12} /> {user.streak} streak</small></div>)}</div>}
        </article>
        {message && <p className="form-message">{message}</p>}
      </section>
    </div>
  );
}

function EmptyRound({ isAdmin, members, start }: { isAdmin: boolean; members: Member[]; start: () => void }) {
  return (
    <section className="empty-state">
      <div className="empty-gem"><Gem size={38} /></div>
      <span className="eyebrow">A fresh circle</span>
      <h2>Waiting for the first gems…</h2>
      <p>{members.length < 2 ? "Invite at least one friend, then your first 12-day listening ritual can begin." : "Your circle is ready. Start the first round when everyone is listening."}</p>
      <div className="member-bubbles">{members.map((member) => <span key={member.id} title={member.users?.nickname}>{member.users?.nickname?.slice(0, 1).toUpperCase()}</span>)}</div>
      {isAdmin && <button className="primary-button compact" disabled={members.length < 2} onClick={start}><Sparkles size={17} /> Start round</button>}
      {!isAdmin && <small>The group admin will start the round.</small>}
    </section>
  );
}

function SongCard({ submission, rating, onRate, disabled }: { submission: Submission; rating?: Emoji; onRate: (emoji: Emoji) => void; disabled: boolean }) {
  const media = provider(submission.song_url);
  return (
    <article className="song-card">
      <div className="song-heading">
        <div className="music-icon"><Music2 size={19} /></div>
        <div><strong>{submission.title || `${submission.users?.nickname || "A group member"}’s gem`}</strong><small>{submission.artist || media?.name || "Music link"} · chosen by {submission.users?.nickname}</small></div>
        {rating && <span className="rated-mark"><Check size={13} /> Rated</span>}
      </div>
      {media ? <iframe src={media.embed} title={`${media.name} player`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> :
        <a className="external-song" href={submission.song_url} target="_blank" rel="noreferrer">Open song <ChevronRight size={15} /></a>}
      <a className="source-link" href={submission.song_url} target="_blank" rel="noopener noreferrer">
        Open the original on {media?.name || "its music site"} <ChevronRight size={13} />
      </a>
      <div className="rating-row">
        {ratingOptions.map((option) => (
          <button key={option.emoji} disabled={disabled} className={rating === option.emoji ? "selected" : ""} onClick={() => onRate(option.emoji)} title={`${option.label} · ${option.points} points`}>
            <span>{option.emoji}</span><small>{option.points}pt</small>
          </button>
        ))}
      </div>
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
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showGroupSetup, setShowGroupSetup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [view, setView] = useState<"round" | "history">("round");
  const [tick, setTick] = useState(0);

  const loadGroups = useCallback(async () => {
    const { data: me } = await supabase.from("users").select("*").eq("id", session.user.id).maybeSingle();
    setProfile(me);
    const { data: memberships } = await supabase.from("group_members").select("group_id,status").eq("user_id", session.user.id);
    const approvedIds = (memberships || []).filter((m) => m.status === "approved").map((m) => m.group_id);
    if (approvedIds.length) {
      const { data } = await supabase.from("groups").select("*").in("id", approvedIds).order("created_at");
      setGroups(data || []);
      setSelectedId((current) => current || data?.[0]?.id || "");
    } else {
      setGroups([]);
    }
    setLoading(false);
  }, [session.user.id]);

  const loadGroup = useCallback(async () => {
    if (!selectedId) return;
    const [{ data: memberData }, { data: roundData }] = await Promise.all([
      supabase.from("group_members").select("*,users!group_members_user_id_fkey(id,nickname,streak)").eq("group_id", selectedId).order("created_at"),
      supabase.from("rounds").select("*").eq("group_id", selectedId).order("round_number", { ascending: false }),
    ]);
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
  const mySubmission = currentSubmissions.find((item) => item.user_id === session.user.id);
  const phaseTarget = phase === "submit" ? currentRound?.submission_ends_at : currentRound?.rating_ends_at;
  void tick;

  async function startRound() {
    if (!group) return;
    const previous = rounds[0];
    const starts = new Date();
    const submissionEnd = new Date(starts.getTime() + 5 * 86400000);
    const ratingEnd = new Date(starts.getTime() + 12 * 86400000);
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
    const payload = { group_id: selectedId, round_id: currentRound.id, user_id: session.user.id, song_url: songUrl.trim() };
    const { error } = await supabase.from("submissions").upsert(payload, { onConflict: "round_id,user_id" });
    if (error) setNotice(error.message); else { setNotice(mySubmission ? "Your gem was updated." : "Your gem is locked in."); loadGroup(); }
  }

  async function rate(submissionId: string, emoji: Emoji) {
    if (!currentRound) return;
    const { error } = await supabase.from("ratings").upsert({
      group_id: selectedId,
      round_id: currentRound.id,
      submission_id: submissionId,
      user_id: session.user.id,
      emoji,
    }, { onConflict: "submission_id,user_id" });
    if (error) setNotice(error.message); else loadGroup();
  }

  async function approve(member: Member, status: "approved" | "rejected") {
    const { error } = await supabase.from("group_members").update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? session.user.id : null,
    }).eq("id", member.id);
    if (error) setNotice(error.message); else loadGroup();
  }

  async function fastForward(days: number) {
    if (!currentRound) return;
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
        <Logo />
        <nav>
          <button className={view === "round" ? "active" : ""} onClick={() => setView("round")}><Gem size={16} /> Current round</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><History size={16} /> History</button>
        </nav>
        <div className="user-menu">
          <span className="avatar">{profile.nickname.slice(0, 1).toUpperCase()}</span>
          <span>{profile.nickname}</span>
          <span className="streak"><Flame size={15} /> {profile.streak}</span>
          <button onClick={() => setShowProfile(true)} aria-label="Open profile"><UserRound size={17} /></button>
          <button onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>
      {notice && <Notice message={notice} clear={() => setNotice("")} />}
      {showProfile && <UserPanel profile={profile} close={() => setShowProfile(false)} />}
      {showGroupSetup && <div className="modal-backdrop"><div className="group-modal"><button className="modal-close" onClick={() => setShowGroupSetup(false)}><X size={18} /></button><GroupSetup onDone={() => { setShowGroupSetup(false); loadGroups(); }} /></div></div>}
      <main className="dashboard">
        <aside>
          <p className="sidebar-label">Your circles</p>
          {groups.map((item) => <button key={item.id} className={item.id === selectedId ? "group-link active" : "group-link"} onClick={() => setSelectedId(item.id)}><span>{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.id === selectedId ? `${approved.length} members` : "Listening circle"}</small></div></button>)}
          <button className="new-group" onClick={() => setShowGroupSetup(true)}><Plus size={16} /> New circle</button>
        </aside>
        <div className="main-column">
          <section className="group-hero">
            <div>
              <span className="eyebrow"><Gem size={13} /> Listening circle</span>
              <h1>{group?.name}</h1>
              {group?.rules && <p>“{group.rules}”</p>}
            </div>
            <div className="hero-meta">
              {currentRound && <span>Round {currentRound.round_number}</span>}
              <span><Users size={15} /> {approved.length}/8</span>
              {isAdmin && <button onClick={() => setShowSettings(!showSettings)}><Settings2 size={17} /></button>}
            </div>
          </section>

          {view === "round" && pending.length > 0 && isAdmin && (
            <section className="admin-card">
              <div><ShieldCheck size={19} /><div><strong>{pending.length} join request{pending.length > 1 ? "s" : ""}</strong><small>Your circle stays private until you approve.</small></div></div>
              {pending.map((member) => <div className="request-row" key={member.id}><span className="avatar">{member.users?.nickname?.slice(0, 1).toUpperCase()}</span><strong>{member.users?.nickname}</strong><button onClick={() => approve(member, "rejected")} className="ghost-button">Decline</button><button onClick={() => approve(member, "approved")} className="small-button">Approve</button></div>)}
            </section>
          )}

          {view === "round" && showSettings && isAdmin && process.env.NODE_ENV === "development" && (
            <section className="dev-card">
              <div><Settings2 size={18} /><div><strong>Time Machine</strong><small>Development only · shift this round forward</small></div></div>
              <div>{[1, 5, 12].map((days) => <button key={days} onClick={() => fastForward(days)}>+{days} day{days > 1 ? "s" : ""}</button>)}</div>
              <button onClick={seedDummyData}>Add dummy data</button>
            </section>
          )}

          {view === "round" && phase === "empty" && <EmptyRound isAdmin={isAdmin} members={approved} start={startRound} />}

          {view === "round" && phase !== "empty" && (
            <section className="round-status">
              <div className={`phase-step ${phase === "submit" ? "active" : "done"}`}><span>{phase === "submit" ? "1" : <Check size={15} />}</span><div><strong>Submit</strong><small>Days 1–5</small></div></div>
              <i />
              <div className={`phase-step ${phase === "rate" ? "active" : phase === "reveal" ? "done" : ""}`}><span>{phase === "reveal" ? <Check size={15} /> : "2"}</span><div><strong>Rate</strong><small>Days 6–12</small></div></div>
              <i />
              <div className={`phase-step ${phase === "reveal" ? "active" : ""}`}><span>3</span><div><strong>Reveal</strong><small>After day 12</small></div></div>
              {phase !== "reveal" && <div className="countdown"><Clock3 size={16} /><strong>{countdown(phaseTarget)}</strong><small>UTC countdown</small></div>}
            </section>
          )}

          {view === "round" && phase === "submit" && (
            <section className="content-card submit-card">
              <div className="section-title"><div><span className="eyebrow">Submission phase</span><h2>{mySubmission ? "Your gem is in." : "What’s your gem?"}</h2><p>{mySubmission ? "You can swap it anytime before the countdown ends." : "Share one track or album. Nobody sees what it is until rating begins."}</p></div><div className="progress-ring"><strong>{currentSubmissions.length}/{approved.length}</strong><small>submitted</small></div></div>
              <form onSubmit={saveSubmission} className="song-form">
                <Music2 size={18} />
                <input value={songUrl} onChange={(e) => setSongUrl(e.target.value)} placeholder={mySubmission ? "Paste a new Spotify or YouTube link to swap" : "Paste a Spotify or YouTube link"} required />
                <button>{mySubmission ? "Swap gem" : "Submit gem"} <ChevronRight size={16} /></button>
              </form>
              {mySubmission && <div className="locked-note"><Check size={16} /><span>Your current link is safely hidden from the group.</span></div>}
              <div className="member-progress">
                {approved.map((member) => {
                  const done = currentSubmissions.some((item) => item.user_id === member.user_id);
                  return <div key={member.id} className={done ? "done" : ""}><span>{member.users?.nickname?.slice(0, 1).toUpperCase()}</span><strong>{member.users?.nickname}</strong><small>{done ? "Gem secured" : "Choosing…"}</small>{done && <Check size={14} />}</div>;
                })}
              </div>
            </section>
          )}

          {view === "round" && phase === "rate" && (
            <section className="rating-section">
              <div className="section-title"><div><span className="eyebrow">The gems are unlocked</span><h2>Listen with intention.</h2><p>Rate every song with exactly one reaction. You can change it until time runs out.</p></div><div className="progress-ring"><strong>{myRatings.length}/{currentSubmissions.length}</strong><small>rated</small></div></div>
              <div className="rating-legend">{ratingOptions.map((item) => <span key={item.emoji}><b>{item.emoji}</b>{item.points} pt · {item.label}</span>)}</div>
              <div className="song-grid">{currentSubmissions.map((submission) => <SongCard key={submission.id} submission={submission} rating={myRatings.find((rating) => rating.submission_id === submission.id)?.emoji} onRate={(emoji) => rate(submission.id, emoji)} disabled={false} />)}</div>
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
              rounds.filter((round) => phaseOf(round) === "reveal").map((round) => <div className="history-row" key={round.id}><span><Gem size={17} /></span><div><strong>Round {round.round_number}</strong><small>{new Date(round.starts_at).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</small></div><div>{submissions.filter((item) => item.round_id === round.id).length} gems</div><ChevronRight size={17} /></div>)}
          </section>}
        </div>
      </main>
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
  if (session === undefined) return <div className="full-loader"><Gem className="pulse" size={34} /></div>;
  return session ? <Dashboard session={session} /> : <AuthScreen />;
}
