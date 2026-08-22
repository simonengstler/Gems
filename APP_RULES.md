# Gems product rules

This file is the canonical product specification for Gems. It describes
user-visible behavior and invariants. Technical implementation details belong in
`docs/ARCHITECTURE.md`.

## 1. Product concept

Gems is a private, responsive music-discovery ritual for small circles of
friends and family. Each round lets members privately submit a musical find,
listen together, react, and preserve the results as a shared history.

The visual language uses gems to represent songs worth keeping.

The interface is available in English and German. A visible language switch
changes the app language and remembers the choice on the user’s device. German
uses **Circle** as the product term.

## 2. Accounts and profiles

- Authentication uses Supabase email and password.
- Users must confirm their email before signing in when confirmation is enabled.
- Password reset and authenticated password changes are supported.
- Every user chooses a globally unique nickname of 2–32 characters during registration.
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
- A recording that appeared in an earlier round of the same Circle cannot be
  submitted again. Spotify and YouTube links are compared by provider identity
  and conservative normalized artist, title, and version metadata. Remixes,
  live recordings, covers, acoustic versions, edits, and other clearly labeled
  distinct versions remain eligible.
- Coincidentally matching private submissions in the same round are allowed.
  They do not reveal or block another member's hidden choice. After that round,
  the recording counts as used for future rounds.
- During choosing, the uploader sees the saved song's title, artist, artwork,
  and provider link immediately after submission and when returning to the app.
- Other members can see submission progress, but titles, artists, URLs, and
  submitter identities remain hidden until rating begins.
- Once every approved member has submitted, a circle admin may end the choosing
  interval immediately and open rating for the whole circle.

### Phase 2: Rate

- Submissions are locked.
- Songs and submitters are revealed.
- Every member may give exactly one reaction to each other member's submission
  and may change it until the rating deadline. Members cannot rate their own
  submission.
- A reaction remains locked until the member opens that song's player or
  original provider link during the current visit.
- Reactions and points are:

| Reaction | Points | Meaning |
| --- | ---: | --- |
| 🖤 | 3 | I did not know this song, and I love it. |
| ❤️ | 2 | I knew this song, and I love it. |
| 👍 | 1 | Good song; I would add it to my playlist. |
| 👌 | 0 | Decent song, but not quite my taste. |
| 🤔 | 0 | Interesting choice, but it does not appeal to me. |

- Circle-wide rating progress is the number of completed reactions divided by
  all eligible member/submission pairs. Self-rating pairs are excluded.
- Once every approved member has rated every eligible submission, a circle
  admin may end the rating interval immediately and reveal the results.

### Phase 3: Reveal and history

- Scores are the sum of reaction points.
- The completed round shows a leaderboard, reactions, submitters, and links.
- Completed rounds remain accessible in History.
- An admin may start the next round manually.
- Ending choosing early preserves the current round's full configured rating
  interval. It does not shorten the next phase or a later round.
- Automatic round starts happen only when the circle enables automation and an
  external scheduler calls the protected cron endpoint.

## 5. Notifications and cost controls

- Browser push is opt-in for each user/device and can be disabled at the circle
  level.
- Email delivery has a circle-level master switch that defaults to off.
- Round-started, rating-started, results-ready, and one-day reminder
  notifications have individual switches.
- Notification delivery is idempotent; the same event must not be sent twice to
  the same recipient for one round.
- When Resend is not configured, email work is a dry run and no email is sent.
- Enabling a circle’s email master switch sends the enabling admin a test email
  when delivery is configured. The admin view reports a clear configuration
  error when it is not.
- A manually started round, an admin's early transition, and a Time Machine
  shortcut to the next phase send their enabled email alerts immediately
  through a protected server route.
  Old phase events are never sent as a catch-up backlog.
- The daily Vercel check remains responsible for automatic rounds and
  deadline-based listening/results fallbacks; it is not a minute-precise
  scheduler.
- Every email subject and body identifies the affected Circle by name. There
  are six email categories:

| Email | Recipients | When it is sent |
| --- | --- | --- |
| Test email | The enabling/admin-testing admin | Immediately when email is enabled or the test action is used. |
| New round | Every approved Circle member | Immediately after an admin starts a round; for automatic rounds, when the daily check creates it. |
| Choosing reminder | Approved members who have not submitted | During the daily check in the final 24 hours of a choosing interval longer than one day. |
| Songs ready | Every approved Circle member | Immediately when an admin opens listening early; otherwise in the first daily fallback after the rating phase begins. |
| Rating reminder | Approved members who still have eligible songs to rate | During the daily check in the final 24 hours of a rating interval longer than one day. |
| Results ready | Every approved Circle member | Immediately when an admin reveals results; otherwise in the first daily fallback after rating ends. |

  Each event is sent at most once per recipient and round. One-day phases do
  not send a separate reminder because their phase-opening email already serves
  that purpose.
- A platform-operator view shows reference free-tier limits plus protected live
  application counters and remaining Resend allowances calculated from Gems'
  successful-delivery log. It is not visible to ordinary users or circle
  admins. Provider reference limits must be periodically reverified.

## 6. Administrative and developer tools

- Time Machine is visible only to a circle admin.
- Time Machine can move the current round forward by 1, 5, or 12 days, or jump
  directly to the next phase, in local and production environments. Jumping
  from choosing to listening preserves the round's stored listening duration.
- Jumping directly to listening or results sends the same enabled immediate
  email as the corresponding normal admin phase-completion action.
- Moving the round forward by a number of days also sends the enabled email
  when that move crosses into listening or results.
- Time Machine must ask for confirmation because it changes deadlines for every
  member of the circle.
- Dummy data is development-only. It creates fake users, submissions, and
  ratings for local layout and lifecycle testing.
- The production seed endpoint must reject every request.
- Platform administration is a separate allowlist-backed role. It is not
  implied by being a circle admin.
- The new-circle entry point remains available on mobile as well as desktop.
- Early phase completion is checked atomically by the database and requires
  confirmation because it changes the shared live deadline.

## 7. Product boundaries

- Circles are private; discovery does not expose circle membership or content.
- User search exposes a listener profile and aggregate activity visible through
  the requester’s existing circle access. It never exposes private circle
  membership or content.
- Gems uses public provider embeds and oEmbed metadata by default. It does not
  require paid Spotify or YouTube API access for the core flow.
- The product should remain usable on free service tiers during development and
  early personal use.
