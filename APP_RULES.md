# GEMS - APP_RULES.md (God Prompt & Context)

## 1. App Concept
"Gems" is a modern, responsive web application where friends and family share unique musical discoveries. The core visual theme is "gems"—representing songs that enrich users' playlists. 

## 2. Tech Stack
- **Framework:** Next.js (App Router) + React
- **Database & Auth:** Supabase (PostgreSQL, Email/Password Auth, Row Level Security)
- **Styling:** Tailwind CSS + Shadcn UI + Lucide Icons
- **Emails:** Resend API
- **i18n:** next-intl (setup for English default, scalable later)

## 3. Core Entities & Rules

### A. Users
- Authentication is strictly email-based (includes password reset).
- Users choose a unique, immutable "nickname" upon registration.
- No access to the main dashboard until fully authenticated.

### B. Groups
- **Size:** Minimum 2 members, Maximum 8 members.
- **Names:** Must be globally unique and immutable.
- **Creation:** Creator sets the name, optional rules, and becomes the Admin.
- **Joining:** Users enter the exact group name and remain in a "pending" state until Admin approval.
- **Empty States:** Whenever a group is new or waiting for input, display a beautiful, engaging "Empty State" UI (e.g., "Waiting for the first gems... invite your friends!") rather than a blank screen.

## 4. The Sharing Cycle (12 Days Total)

**CRITICAL TIMEZONE RULE:** All dates and timestamps in the Supabase database MUST be stored in strict UTC. The frontend MUST calculate time remaining and display it strictly as a countdown (e.g., "14 hours left to submit") to completely avoid user timezone confusion.

### Phase 1: Submission Phase (Days 1-5)
- Users submit one song by pasting a URL.
- **Robust Parsing:** The system must use robust Regex to parse all variations of Spotify links (tracks, albums) and YouTube links (youtu.be, watch?v=, shorts). 
- **Display:** Render valid links via standard HTML `<iframe>` for in-app playback.
- **Edit Capability:** Users can edit or swap their submitted link at any point during these 5 days.
- **Visibility:** Show a progress tracker (e.g., "4/8 members submitted"), but DO NOT reveal song titles, artists, or submitters.

### Phase 2: Rating Phase (Days 6-12)
- Submissions lock. The "Edit" button disappears. All songs are revealed.
- Every member must listen to all songs and rate them using EXACTLY ONE of these five emojis:
  - 🖤 Black heart (3 pts): "I don't know this song but I love it"
  - ❤️ Red heart (2 pts): "I know this song and I love it"
  - 👍 Thumbs up (1 pt): "Good song, I will add it to my playlist"
  - 👌 OK hand (0 pts): "Decent song, but not quite my taste"
  - 🤔 Thinking (0 pts): "Interesting choice, but doesn't appeal to my ears"
- Show real-time visual progress of ratings (e.g., "UserX has rated 3/8 songs").

### Phase 3: Reveal & Restart
- After Day 12, calculate points for each song.
- Publish the leaderboard and emojis to a persistent "Chat/History" log in the group.
- Automatically start a new 12-day cycle.

## 5. Engagement & Streaks
- **The Streak System:** Track how many consecutive rounds a user has successfully submitted and rated a song. Display a 🔥 icon with their streak number next to their nickname.
- **Penalty:** Failing to submit or rate by the respective deadlines resets their streak to 0.
- **Notifications (via Resend):**
  - "Round Started! Submit your gem."
  - "Time to Rate! New gems are unlocked."
  - "Streak Danger! Only 12 hours left to rate or you lose your streak."

## 6. Developer Tools (Only visible in Dev Environment)
To allow for rapid testing without waiting 12 days, the AI must implement the following developer utilities:
1. **The Time Machine:** A hidden admin button that fast-forwards the group's internal clock by 1 day, 5 days, or 12 days to test cycle transitions.
2. **Dummy Data Script:** A script that can be triggered to instantly populate a group with 3 fake users, mock valid Spotify/YouTube submissions, and randomized emoji ratings to test the UI layout.