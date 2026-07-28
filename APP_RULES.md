# Gems product rules

This file is the canonical product specification for Gems. It describes
user-visible behavior and invariants. Technical implementation details belong in
`docs/ARCHITECTURE.md`.

## 1. Product concept

Gems is a private, responsive music-discovery ritual for small circles of
friends and family. Each round lets members privately submit a musical find,
listen together, react, and preserve the results as a shared history.

The visual language uses gems to represent songs worth keeping.

## 2. Accounts and profiles

- Authentication uses Supabase email and password.
- Users must confirm their email before signing in when confirmation is enabled.
- Password reset and authenticated password changes are supported.
- Every user chooses a globally unique nickname of 2–32 characters.
- Nicknames are immutable.
- The profile view shows aggregate activity and reactions received across all
  accessible circles.
- Authenticated users can search for other users by nickname.
- Users cannot access the main dashboard without a valid session and profile.

## 3. Circles

- A circle has a globally unique, immutable name.
- The creator becomes its first approved admin.
- Circle size is limited to 8 members.
- At least 2 approved members are required to start a round.
- Users may request membership by exact circle name or a private invitation
  link. An admin must approve the request before circle data becomes accessible.
- Invitation links expire after 14 days.
- Admins can approve or reject requests, remove members, edit circle rules,
  configure notifications and automation, create invitations, and archive a
  circle.
- Members may leave a circle. The sole admin cannot leave without preserving a
  valid administrative owner.
- Archived circles disappear from the active circle list, while their database
  history is retained.
- Empty states must explain the next useful action rather than showing a blank
  screen.

## 4. The sharing cycle

All persisted timestamps are UTC. The interface describes remaining time as a
countdown so members do not have to interpret a shared timezone.

Circle admins choose the duration of the submission and rating intervals for
future rounds. Each interval may be 1–14 days. Changing the setting does not
alter a round already in progress.

### Phase 1: Submit

- Each approved member may submit one Spotify track/album or YouTube
  video/Short link.
- Supported URL variants include Spotify open links, `youtu.be`, YouTube
  `watch?v=`, Shorts, and embed URLs.
- Valid media is playable with an embedded player when the provider permits it.
- Every revealed song also has a direct link to the original provider.
- A member may replace their own submission until the submission deadline.
- Other members can see submission progress, but titles, artists, URLs, and
  submitter identities remain hidden until rating begins.

### Phase 2: Rate

- Submissions are locked.
- Songs and submitters are revealed.
- Every member may give exactly one reaction to each submission and may change
  it until the rating deadline.
- Reactions and points are:

| Reaction | Points | Meaning |
| --- | ---: | --- |
| 🖤 | 3 | I did not know this song, and I love it. |
| ❤️ | 2 | I knew this song, and I love it. |
| 👍 | 1 | Good song; I would add it to my playlist. |
| 👌 | 0 | Decent song, but not quite my taste. |
| 🤔 | 0 | Interesting choice, but it does not appeal to me. |

- Rating progress is visible without publishing the final ranking early.

### Phase 3: Reveal and history

- Scores are the sum of reaction points.
- The completed round shows a leaderboard, reactions, submitters, and links.
- Completed rounds remain accessible in History.
- An admin may start the next round manually.
- Automatic round starts happen only when the circle enables automation and an
  external scheduler calls the protected cron endpoint.

## 5. Streaks

- A streak counts consecutive completed rounds in which a user both submitted a
  gem and rated every required submission.
- Streak finalization occurs when the next round is created.
- Missing the submission or rating requirement resets the streak to zero.
- The interface displays a flame and the current streak beside the nickname.

## 6. Notifications and cost controls

- Browser push is opt-in for each user/device and can be disabled at the circle
  level.
- Email delivery has a circle-level master switch that defaults to off.
- Round-started, rating-started, and 12-hour streak-warning notifications have
  individual switches.
- Notification delivery is idempotent; the same event must not be sent twice to
  the same recipient for one round.
- When Resend is not configured, email work is a dry run and no email is sent.
- A platform-operator view shows reference free-tier limits. It is not visible
  to ordinary users or circle admins. These are guidance, not live billing
  meters, and must be periodically reverified with providers.

## 7. Administrative and developer tools

- Time Machine is visible only to a circle admin.
- Time Machine can move the current round forward by 1, 5, or 12 days in local
  and production environments.
- Time Machine must ask for confirmation because it changes deadlines for every
  member of the circle.
- Dummy data is development-only. It creates fake users, submissions, and
  ratings for local layout and lifecycle testing.
- The production seed endpoint must reject every request.
- Platform administration is a separate allowlist-backed role. It is not
  implied by being a circle admin.

## 8. Product boundaries

- Circles are private; discovery does not expose circle membership or content.
- User search exposes a listener profile, including streak and aggregate
  activity visible through the requester’s existing circle access. It never
  exposes private circle membership or content.
- Gems uses public provider embeds and oEmbed metadata by default. It does not
  require paid Spotify or YouTube API access for the core flow.
- The product should remain usable on free service tiers during development and
  early personal use.
