"use client";

import {
  Check,
  ChevronRight,
  Clock3,
  Copy,
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
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { parseProviderUrl } from "@/lib/song-identity";
import { createClient } from "@/lib/supabase";

type Profile = { id: string; nickname: string };
type Group = {
  id: string;
  name: string;
  rules: string | null;
  created_by: string;
  created_at: string;
  archived_at?: string | null;
};
type CircleOverview = {
  round: Round | null;
  memberCount: number;
  submissionCount: number;
  ratingCount: number;
  eligibleRatingTotal: number;
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
type GroupSettings = {
  email_notifications_enabled: boolean;
  round_started_email: boolean;
  rating_started_email: boolean;
  round_completed_email: boolean;
  phase_reminder_email: boolean;
  auto_start_rounds: boolean;
  push_notifications_enabled: boolean;
  submission_interval_days: number;
  rating_interval_days: number;
};
type Language = "en" | "de";
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
  { emoji: "❤️", points: 3, label: "I know it, and I love it" },
  { emoji: "👍", points: 2, label: "Good — I like it" },
  { emoji: "👌", points: 1, label: "Decent, not bad" },
  { emoji: "🤔", points: 0, label: "Interesting, not quite my taste" },
];

const ui = {
  en: {
    language: "🇩🇪",
    languageLabel: "Deutsch anzeigen",
    authEyebrow: "Share music with your people",
    authTitle: <>Share a song.<br />Find new <em>favorites.</em></>,
    authDescription: "Gems is a private music circle for friends and family. Everyone adds one song. Then you listen and react together.",
    share: "Share", shareHint: "Add one song", listen: "Listen", listenHint: "React together", reveal: "Reveal", revealHint: "See the favorites",
    welcome: "Welcome", signInTitle: "Sign in", signInDescription: "Continue with your music circle.",
    signupKicker: "New to Gems?", signupTitle: "Create your account", signupDescription: "Choose a nickname your friends know. You cannot change it later.",
    resetKicker: "Password help", resetTitle: "Reset your password", resetDescription: "We will email you a link to choose a new password.",
    nickname: "Nickname", email: "Email", password: "Password", passwordPlaceholder: "At least 8 characters", forgotPassword: "Forgot password?",
    signIn: "Sign in", createAccount: "Create account", sendResetLink: "Send reset link", newHere: "New here?", alreadyHaveAccount: "Already have an account?",
    resetSent: "Password reset link sent. Check your inbox.", signedUp: "Check your email to confirm your account. Then sign in.", somethingWrong: "Something went wrong.",
    setupKicker: "Your music circle", setupTitle: "Create or join a circle", setupDescription: "Create a private circle for friends, or join one with its exact name.", create: "Create", join: "Join", circleName: "Circle name", exactCircleName: "Enter the exact circle name", rules: "Circle rules", optional: "optional", createCircle: "Create circle", requestJoin: "Ask to join", requestSent: "Request sent. The circle admin can approve you.", couldNotContinue: "Could not continue.",
    home: "Home", currentRound: "Current round", history: "History", newCircle: "New circle", profile: "Profile", admin: "Admin", yourCircles: "Your circles", members: "members", listeningCircle: "Music circle",
    noRoundYet: "Ready to start",
    homeEyebrow: "Music with friends, not an endless feed", homeTitle: "Share songs. Discover new favorites.", homeDescription: "Gems is a private music circle. Each person adds one song, then everyone listens and reacts. Your favorites stay saved.", choosePrivately: "Add a song", choosePrivatelyText: "Each person shares one song. It stays hidden until listening begins.", listenTogether: "Listen and react", listenTogetherText: "Listen to the songs and choose a simple reaction.", keepWhatMatters: "See the results", keepWhatMattersText: "Find the favorites and keep every round in your history.", goToRound: "Go to current round",
    freshCircle: "A new circle", waitingForGems: "Ready for your first round", needFriend: "Invite at least one friend. Then the admin can start the first round.", circleReady: "Your circle is ready. The admin can start the first round.", startRound: "Start round", adminStarts: "The circle admin will start the round.",
    submit: "Submit", rate: "Rate", revealPhase: "Reveal", choosing: "Choose a song", listening: "Listen and react", revealWhenClosed: "See results", utcCountdown: "Time left", submissionPhase: "Add your song", yourGemIn: "Your song is added.", whatsYourGem: "Which song do you want to share?", swapAnytime: "You can change it until time runs out.", shareTrack: "Add one Spotify track, album, or YouTube video. It stays hidden until everyone can listen.", pasteMusic: "Paste a Spotify or YouTube link", pasteNewMusic: "Paste a new Spotify or YouTube link", submitGem: "Add song", swapGem: "Change song", needGem: "Need a song? Find one on", pasteLink: "then paste the link here.", yourSubmittedSong: "Your submitted song", currentLinkHidden: "Only you can see this song until listening begins.", songAdded: "Song added", choosingSong: "Choosing a song…", allSongsIn: "Everyone added a song.", openRating: "You can open listening now instead of waiting.", endChoosing: "Start listening",
    gemsUnlocked: "Songs are ready", listenWithIntention: "Listen, then react.", ratingDescription: "Open each song before you react. You cannot react to your own song.", circleRatings: "reactions", allReactionsIn: "Everyone has reacted.", revealResultsNow: "You can show the results now instead of waiting.", endRating: "Show results", roundComplete: "Round complete", brightestGems: "Circle favorites", revealDescription: "Every song and reaction, saved for your circle.", openSong: "Open song", points: "pts", startNextRound: "Start next round", vault: "Your music history", listeningHistory: "Past rounds", noHistory: "Completed rounds will appear here.",
    loading: "Loading Gems…",
    rated: "Rated", openPlayer: "Open player to listen", reactionsUnlock: "Reactions unlock after this click", openOriginal: "Open the original on", ownSong: "This is your song. Listen, but leave the reactions to your circle.", openBeforeReacting: "Open this song before choosing a reaction.",
    yourProfile: "Your profile", listenerProfile: "Listener profile", roundStreak: "round streak", reactionsReceived: "Reactions received", yourGemsByFeeling: "Your gems, by reaction", theirGemsByFeeling: "Their gems, by reaction", security: "Security", changePassword: "Change password", newPassword: "New password", updatePassword: "Update password", passwordUpdated: "Password updated.", enableBrowserNotifications: "Enable browser notifications", browserNotificationsEnabled: "Browser notifications enabled on this device.", pushNotConfigured: "Push is not set up yet.", pushUnsupported: "This browser does not support notifications.", permissionNotGranted: "Notification permission was not granted.", deviceNotSaved: "Could not save this device.", community: "Community", findListener: "Find a listener", searchByNickname: "Search by nickname", search: "Search", streak: "streak", viewProfile: "View profile", close: "Close",
    circleAdministration: "Circle administration", membersAndRounds: "members · rounds", automation: "Automation", costSafeControls: "Cost-safe controls", emailNotifications: "Email notifications", emailNotificationsHelp: "Main switch — keep off in development", roundStartedEmail: "Round started email", roundStartedEmailHelp: "Ask the Circle to add a song", ratingStartedEmail: "Listening started email", ratingStartedEmailHelp: "Tell the Circle that songs are ready", streakWarningEmail: "Streak warning email", streakWarningEmailHelp: "Warn 12 hours before time ends", browserPush: "Browser notifications", browserPushHelp: "Free delivery to opted-in devices", automaticRounds: "Automatic new rounds", automaticRoundsHelp: "Start again after results", invitations: "Invitations", invitePeople: "Invite people", inviteHelp: "Private links expire after 14 days. New members still need approval.", copyInvitation: "Copy invitation", invitationCopied: "Invitation copied. It expires in 14 days.", futureRounds: "Future rounds", listeningRhythm: "Round length", intervalHelp: "Choose the length of future rounds. This round does not change.", choosingInterval: "Song selection", ratingInterval: "Listening and reactions", days: "days", membership: "Membership", peopleInCircle: "People in this Circle", makeAdmin: "Make admin", remove: "Remove", memberPromoted: "Member is now an admin.", memberRemoved: "Member removed.", circleDetails: "Circle details", rulesAndLifecycle: "Rules and lifecycle", writeRules: "Write the Circle rules…", saveRules: "Save rules", archiveCircle: "Archive Circle", rulesUpdated: "Circle rules updated.", archiveConfirm: "Archive this Circle? Its history stays saved.", circleArchived: "Circle archived.",
    leaveCircle: "Leave Circle", round: "Round", adminOnlyTimeMachine: "Admin only · move this Circle’s live round forward", addDummyData: "Add dummy data", joinRequest: "join request", joinRequests: "join requests", privateUntilApproved: "Your Circle stays private until you approve.", decline: "Decline", approve: "Approve", signOut: "Sign out", openProfile: "Open profile", openDeveloperConsole: "Open developer console", newRoundStarted: "A new round has started.", invalidSongUrl: "Paste a valid Spotify track, album, or YouTube link.", duplicateSong: "This song has already appeared in an earlier round of this Circle. Remixes and other distinct versions are still allowed.", submissionClosed: "Choosing has ended, so this song can no longer be changed.", songUpdated: "Your song was updated.", songLocked: "Your song is saved.", cannotRateOwn: "You cannot react to your own song.", allMustSubmit: "Everyone approved must add a song before you can start listening.", allMustReact: "Everyone must react before you can show results.", confirmEndChoosing: "Start listening now for the whole Circle?", confirmEndRating: "Show results now for the whole Circle?", choosingComplete: "Song selection is complete. Listening is now open.", ratingComplete: "Listening is complete. The results are ready.", leaveConfirm: "Leave {name}?", leftCircle: "You left the Circle.", timeMachineConfirm: "Move this Circle’s round forward by {days} days? This changes the deadlines for everyone.", timeMoved: "Time moved forward {days} days.", dummyDataAdded: "Added test listeners, songs, and reactions.", couldNotCreateDummyData: "Could not create dummy data.", songBy: "song by", musicLink: "Music link", chosenBy: "chosen by", musicSite: "music site", loadingControls: "Loading saved controls…", couldNotLoadControls: "Could not load this Circle’s saved controls.", sendingTest: "Sending test…", sendTestEmail: "Send a test email to me", testEmailHelp: "A test confirms the sender setup. New rounds and early phase changes email immediately.", testEmailSent: "Test email sent to your signed-in address.", couldNotSendTestEmail: "Could not send a test email.",
    timeMachine: "Time Machine", timeMachineSkipToListening: "Skip to listening", timeMachineSkipToResults: "Skip to results", timeMachinePhaseConfirm: "Move this Circle directly to the next phase? This changes shared deadlines for everyone.", timeMachinePhaseMoved: "Time moved to the next phase.", phaseEmailFailed: "The phase changed, but its notification email could not be sent. Check the email controls and try the test email.",
    roundCompletedEmail: "Results ready email", roundCompletedEmailHelp: "Tell the Circle that results are ready to see", phaseReminderEmail: "Two-day reminder emails", phaseReminderEmailHelp: "Remind only members who still need to act during the final two days",
  },
  de: {
    language: "🇬🇧",
    languageLabel: "Show English",
    authEyebrow: "Teile Musik mit deinen Leuten",
    authTitle: <>Teile Songs.<br />Entdecke neue <em>Favoriten.</em></>,
    authDescription: "Gems ist ein privater Music Circle für Freunde und Familie. Jede Person fügt einen Song hinzu. Dann hört ihr gemeinsam und reagiert darauf.",
    share: "Teilen", shareHint: "Einen Song hinzufügen", listen: "Hören", listenHint: "Zusammen reagieren", reveal: "Ergebnisse", revealHint: "Favoriten sehen",
    welcome: "Willkommen", signInTitle: "Anmelden", signInDescription: "Weiter zu deinem Music Circle.",
    signupKicker: "Neu bei Gems?", signupTitle: "Konto erstellen", signupDescription: "Wähle einen Namen, den deine Freunde kennen. Du kannst ihn später nicht ändern.",
    resetKicker: "Passwort-Hilfe", resetTitle: "Passwort zurücksetzen", resetDescription: "Wir schicken dir einen Link für ein neues Passwort.",
    nickname: "Name", email: "E-Mail", password: "Passwort", passwordPlaceholder: "Mindestens 8 Zeichen", forgotPassword: "Passwort vergessen?",
    signIn: "Anmelden", createAccount: "Konto erstellen", sendResetLink: "Link senden", newHere: "Neu hier?", alreadyHaveAccount: "Schon ein Konto?",
    resetSent: "Link zum Zurücksetzen gesendet. Schau in dein Postfach.", signedUp: "Bestätige deine E-Mail. Danach kannst du dich anmelden.", somethingWrong: "Etwas ist schiefgelaufen.",
    setupKicker: "Dein Music Circle", setupTitle: "Circle erstellen oder beitreten", setupDescription: "Erstelle einen privaten Circle für Freunde oder tritt mit dem genauen Namen bei.", create: "Erstellen", join: "Beitreten", circleName: "Circle-Name", exactCircleName: "Genauen Circle-Namen eingeben", rules: "Circle-Regeln", optional: "optional", createCircle: "Circle erstellen", requestJoin: "Beitritt anfragen", requestSent: "Anfrage gesendet. Der Admin kann dich freigeben.", couldNotContinue: "Weiter geht es gerade nicht.",
    home: "Start", currentRound: "Aktuelle Runde", history: "Verlauf", newCircle: "Neuer Circle", profile: "Profil", admin: "Admin", yourCircles: "Deine Circles", members: "Mitglieder", listeningCircle: "Music Circle",
    noRoundYet: "Bereit zum Start",
    homeEyebrow: "Musik mit Freunden, nicht mit einem endlosen Feed", homeTitle: "Teile Songs. Entdecke neue Favoriten.", homeDescription: "Gems ist ein privater Music Circle. Jede Person fügt einen Song hinzu, dann hören alle und reagieren. Eure Favoriten bleiben gespeichert.", choosePrivately: "Song hinzufügen", choosePrivatelyText: "Jede Person teilt einen Song. Er bleibt verborgen, bis das Hören beginnt.", listenTogether: "Hören und reagieren", listenTogetherText: "Höre die Songs und wähle eine einfache Reaktion.", keepWhatMatters: "Ergebnisse sehen", keepWhatMattersText: "Finde eure Favoriten und bewahre jede Runde im Verlauf.", goToRound: "Zur aktuellen Runde",
    freshCircle: "Ein neuer Circle", waitingForGems: "Bereit für die erste Runde", needFriend: "Lade mindestens einen Freund ein. Dann kann der Admin die erste Runde starten.", circleReady: "Dein Circle ist bereit. Der Admin kann die erste Runde starten.", startRound: "Runde starten", adminStarts: "Der Admin startet die Runde.",
    submit: "Hinzufügen", rate: "Reagieren", revealPhase: "Ergebnisse", choosing: "Song auswählen", listening: "Hören und reagieren", revealWhenClosed: "Ergebnisse sehen", utcCountdown: "Verbleibende Zeit", submissionPhase: "Deinen Song hinzufügen", yourGemIn: "Dein Song ist hinzugefügt.", whatsYourGem: "Welchen Song möchtest du teilen?", swapAnytime: "Du kannst ihn ändern, bis die Zeit abläuft.", shareTrack: "Füge einen Spotify-Track, ein Album oder ein YouTube-Video hinzu. Der Song bleibt verborgen, bis alle hören können.", pasteMusic: "Spotify- oder YouTube-Link einfügen", pasteNewMusic: "Neuen Spotify- oder YouTube-Link einfügen", submitGem: "Song hinzufügen", swapGem: "Song ändern", needGem: "Suchst du einen Song? Finde ihn auf", pasteLink: "und füge den Link hier ein.", yourSubmittedSong: "Dein hinzugefügter Song", currentLinkHidden: "Nur du kannst diesen Song sehen, bis das Hören beginnt.", songAdded: "Song hinzugefügt", choosingSong: "Song wird ausgewählt…", allSongsIn: "Alle haben einen Song hinzugefügt.", openRating: "Du kannst das Hören jetzt starten.", endChoosing: "Hören starten",
    gemsUnlocked: "Songs sind bereit", listenWithIntention: "Hören, dann reagieren.", ratingDescription: "Öffne jeden Song, bevor du reagierst. Auf deinen eigenen Song kannst du nicht reagieren.", circleRatings: "Reaktionen", allReactionsIn: "Alle haben reagiert.", revealResultsNow: "Du kannst die Ergebnisse jetzt zeigen.", endRating: "Ergebnisse zeigen", roundComplete: "Runde beendet", brightestGems: "Favoriten im Circle", revealDescription: "Jeder Song und jede Reaktion – gespeichert für euren Circle.", openSong: "Song öffnen", points: "Pkt.", startNextRound: "Nächste Runde starten", vault: "Eure Musikgeschichte", listeningHistory: "Vergangene Runden", noHistory: "Abgeschlossene Runden erscheinen hier.",
    loading: "Gems wird geladen…",
    rated: "Bewertet", openPlayer: "Player zum Hören öffnen", reactionsUnlock: "Danach kannst du reagieren", openOriginal: "Original öffnen auf", ownSong: "Das ist dein Song. Hör ihn gern an, aber die Reaktionen sind für deinen Circle.", openBeforeReacting: "Öffne diesen Song, bevor du reagierst.",
    yourProfile: "Dein Profil", listenerProfile: "Hörerprofil", roundStreak: "Runden-Serie", reactionsReceived: "Erhaltene Reaktionen", yourGemsByFeeling: "Deine Gems nach Reaktion", theirGemsByFeeling: "Gems nach Reaktion", security: "Sicherheit", changePassword: "Passwort ändern", newPassword: "Neues Passwort", updatePassword: "Passwort aktualisieren", passwordUpdated: "Passwort aktualisiert.", enableBrowserNotifications: "Browser-Benachrichtigungen aktivieren", browserNotificationsEnabled: "Browser-Benachrichtigungen sind auf diesem Gerät aktiv.", pushNotConfigured: "Push ist noch nicht eingerichtet.", pushUnsupported: "Dieser Browser unterstützt keine Benachrichtigungen.", permissionNotGranted: "Benachrichtigungen wurden nicht erlaubt.", deviceNotSaved: "Dieses Gerät konnte nicht gespeichert werden.", community: "Community", findListener: "Hörer finden", searchByNickname: "Nach Namen suchen", search: "Suchen", streak: "Serie", viewProfile: "Profil ansehen", close: "Schließen",
    circleAdministration: "Circle-Verwaltung", membersAndRounds: "Mitglieder · Runden", automation: "Automatisierung", costSafeControls: "Kostenbewusste Einstellungen", emailNotifications: "E-Mail-Benachrichtigungen", emailNotificationsHelp: "Hauptschalter – in der Entwicklung aus lassen", roundStartedEmail: "E-Mail zum Rundenstart", roundStartedEmailHelp: "Den Circle ans Hinzufügen erinnern", ratingStartedEmail: "E-Mail zum Hörstart", ratingStartedEmailHelp: "Sagen, dass die Songs bereit sind", streakWarningEmail: "Warnung vor Ende der Serie", streakWarningEmailHelp: "12 Stunden vor Ablauf warnen", browserPush: "Browser-Benachrichtigungen", browserPushHelp: "Kostenlos für angemeldete Geräte", automaticRounds: "Automatische neue Runden", automaticRoundsHelp: "Nach den Ergebnissen neu starten", invitations: "Einladungen", invitePeople: "Leute einladen", inviteHelp: "Private Links laufen nach 14 Tagen ab. Neue Mitglieder müssen weiter freigegeben werden.", copyInvitation: "Einladung kopieren", invitationCopied: "Einladung kopiert. Sie läuft nach 14 Tagen ab.", futureRounds: "Künftige Runden", listeningRhythm: "Länge der Runde", intervalHelp: "Lege die Länge künftiger Runden fest. Die aktuelle Runde ändert sich nicht.", choosingInterval: "Song-Auswahl", ratingInterval: "Hören und reagieren", days: "Tage", membership: "Mitgliedschaft", peopleInCircle: "Leute in diesem Circle", makeAdmin: "Zum Admin machen", remove: "Entfernen", memberPromoted: "Mitglied ist jetzt Admin.", memberRemoved: "Mitglied entfernt.", circleDetails: "Circle-Details", rulesAndLifecycle: "Regeln und Ablauf", writeRules: "Circle-Regeln schreiben…", saveRules: "Regeln speichern", archiveCircle: "Circle archivieren", rulesUpdated: "Circle-Regeln aktualisiert.", archiveConfirm: "Diesen Circle archivieren? Der Verlauf bleibt gespeichert.", circleArchived: "Circle archiviert.",
    leaveCircle: "Circle verlassen", round: "Runde", adminOnlyTimeMachine: "Nur für Admins · diese laufende Runde verschieben", addDummyData: "Testdaten hinzufügen", joinRequest: "Beitrittsanfrage", joinRequests: "Beitrittsanfragen", privateUntilApproved: "Dein Circle bleibt privat, bis du freigibst.", decline: "Ablehnen", approve: "Freigeben", signOut: "Abmelden", openProfile: "Profil öffnen", openDeveloperConsole: "Entwicklerkonsole öffnen", newRoundStarted: "Eine neue Runde hat begonnen.", invalidSongUrl: "Füge einen gültigen Spotify-Track, ein Album oder einen YouTube-Link ein.", duplicateSong: "Dieser Song war bereits in einer früheren Runde dieses Circles dabei. Remixe und andere eigenständige Versionen sind weiterhin erlaubt.", submissionClosed: "Die Auswahl ist beendet. Dieser Song kann nicht mehr geändert werden.", songUpdated: "Dein Song wurde aktualisiert.", songLocked: "Dein Song ist gespeichert.", cannotRateOwn: "Du kannst nicht auf deinen eigenen Song reagieren.", allMustSubmit: "Alle freigegebenen Mitglieder müssen einen Song hinzufügen, bevor das Hören beginnt.", allMustReact: "Alle müssen reagieren, bevor du die Ergebnisse zeigen kannst.", confirmEndChoosing: "Hören jetzt für den ganzen Circle starten?", confirmEndRating: "Ergebnisse jetzt für den ganzen Circle zeigen?", choosingComplete: "Song-Auswahl abgeschlossen. Hören ist jetzt möglich.", ratingComplete: "Hören abgeschlossen. Die Ergebnisse sind bereit.", leaveConfirm: "{name} verlassen?", leftCircle: "Du hast den Circle verlassen.", timeMachineConfirm: "Die Runde dieses Circles um {days} Tage verschieben? Das ändert die Zeiten für alle.", timeMoved: "Zeit um {days} Tage verschoben.", dummyDataAdded: "Test-Hörer, Songs und Reaktionen hinzugefügt.", couldNotCreateDummyData: "Testdaten konnten nicht erstellt werden.", songBy: "Song von", musicLink: "Musik-Link", chosenBy: "ausgewählt von", musicSite: "Musikseite", loadingControls: "Gespeicherte Einstellungen werden geladen…", couldNotLoadControls: "Die gespeicherten Einstellungen dieses Circles konnten nicht geladen werden.", sendingTest: "Test wird gesendet…", sendTestEmail: "Test-E-Mail an mich senden", testEmailHelp: "Ein Test prüft die Absender-Einrichtung. Neue Runden und früh beendete Phasen versenden E-Mails sofort.", testEmailSent: "Test-E-Mail an deine angemeldete Adresse gesendet.", couldNotSendTestEmail: "Test-E-Mail konnte nicht gesendet werden.",
    timeMachine: "Zeitmaschine", timeMachineSkipToListening: "Direkt zum Hören", timeMachineSkipToResults: "Direkt zu den Ergebnissen", timeMachinePhaseConfirm: "Diesen Circle direkt in die nächste Phase verschieben? Das ändert die gemeinsamen Fristen für alle.", timeMachinePhaseMoved: "Zeit direkt zur nächsten Phase verschoben.", phaseEmailFailed: "Die Phase wurde geändert, aber die Benachrichtigungs-E-Mail konnte nicht gesendet werden. Prüfe die E-Mail-Einstellungen und sende eine Test-E-Mail.",
    roundCompletedEmail: "E-Mail zu den Ergebnissen", roundCompletedEmailHelp: "Dem Circle mitteilen, dass die Ergebnisse bereit sind", phaseReminderEmail: "Erinnerungs-E-Mails zwei Tage vorher", phaseReminderEmailHelp: "In den letzten zwei Tagen nur Mitglieder erinnern, denen noch etwas fehlt",
  },
} as const;

function LanguageToggle({ language, onChange, compact = false }: { language: Language; onChange: (language: Language) => void; compact?: boolean }) {
  const text = ui[language];
  return <button className={`language-toggle ${compact ? "compact" : ""}`} type="button" onClick={() => onChange(language === "en" ? "de" : "en")} aria-label={text.languageLabel}>{text.language}</button>;
}

const reactionLabels: Record<Language, Record<Emoji, string>> = {
  en: { "🖤": "New to me, and I love it", "❤️": "I know it, and I love it", "👍": "Good — I like it", "👌": "Decent, not bad", "🤔": "Interesting, not quite my taste" },
  de: { "🖤": "Neu für mich, und ich liebe es", "❤️": "Ich kenne es, und ich liebe es", "👍": "Gut – gefällt mir", "👌": "Ganz okay, nicht schlecht", "🤔": "Interessant, nicht ganz mein Geschmack" },
};

function reactionLabel(language: Language, emoji: Emoji) {
  return reactionLabels[language][emoji];
}

const supabase = createClient();

function phaseOf(round: Round | null) {
  if (!round) return "empty" as const;
  const now = Date.now();
  if (now < new Date(round.submission_ends_at).getTime()) return "submit" as const;
  if (now < new Date(round.rating_ends_at).getTime()) return "rate" as const;
  return "reveal" as const;
}

function countdown(target?: string, language: Language = "en") {
  if (!target) return "";
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (language === "de") {
    if (days) return `${days} T ${hours} Std. übrig`;
    if (hours) return `${hours} Std. ${minutes} Min. übrig`;
    return `${minutes} Min. übrig`;
  }
  if (days) return `${days}d ${hours}h left`;
  if (hours) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function provider(url: string) {
  const reference = parseProviderUrl(url);
  if (!reference) return null;
  return reference.provider === "spotify"
    ? { name: "Spotify", embed: `https://open.spotify.com/embed/${reference.mediaKind}/${reference.providerItemId}` }
    : { name: "YouTube", embed: `https://www.youtube.com/embed/${reference.providerItemId}` };
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

function AuthScreen({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const text = ui[language];

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
        setMessage(text.resetSent);
      } else if (mode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname } },
        });
        if (error) throw error;
        if (!result.user) throw new Error("Account could not be created.");
        setMessage(result.session ? (language === "de" ? "Willkommen bei Gems." : "Welcome to Gems.") : text.signedUp);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Logo />
        <LanguageToggle language={language} onChange={setLanguage} />
        <div className="story-copy">
          <span className="eyebrow"><Sparkles size={14} /> {text.authEyebrow}</span>
          <h1>{text.authTitle}</h1>
          <p>{text.authDescription}</p>
        </div>
        <div className="cycle-preview">
          <div><span>01</span><strong>{text.share}</strong><small>{text.shareHint}</small></div>
          <i />
          <div><span>02</span><strong>{text.listen}</strong><small>{text.listenHint}</small></div>
          <i />
          <div><span>03</span><strong>{text.reveal}</strong><small>{text.revealHint}</small></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head"><span className="mobile-logo"><Logo /></span><LanguageToggle language={language} onChange={setLanguage} compact /></div>
          <p className="kicker">{mode === "signup" ? text.signupKicker : mode === "reset" ? text.resetKicker : text.welcome}</p>
          <h2>{mode === "signup" ? text.signupTitle : mode === "reset" ? text.resetTitle : text.signInTitle}</h2>
          <p className="muted">{mode === "signup" ? text.signupDescription : mode === "reset" ? text.resetDescription : text.signInDescription}</p>
          <form onSubmit={submit} className="form-stack">
            {mode === "signup" && (
              <label>{text.nickname}<input name="nickname" minLength={2} maxLength={32} required placeholder="e.g. velvetears" /></label>
            )}
            <label>{text.email}<input name="email" type="email" required placeholder="you@example.com" /></label>
            {mode !== "reset" && (
              <label>{text.password}<input name="password" type="password" minLength={8} required placeholder={text.passwordPlaceholder} /></label>
            )}
            {mode === "login" && <button type="button" className="text-button align-right" onClick={() => setMode("reset")}>{text.forgotPassword}</button>}
            <button className="primary-button" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              {mode === "signup" ? text.createAccount : mode === "reset" ? text.sendResetLink : text.signIn}
              {!busy && <ChevronRight size={17} />}
            </button>
          </form>
          {message && <p className="form-message">{message}</p>}
          <div className="auth-switch">
            {mode === "login" ? <>{text.newHere} <button onClick={() => setMode("signup")}>{text.createAccount}</button></> :
              <>{text.alreadyHaveAccount} <button onClick={() => setMode("login")}>{text.signIn}</button></>}
          </div>
        </div>
      </section>
    </main>
  );
}

function GroupSetup({ onDone, language, setLanguage }: { onDone: () => void; language: Language; setLanguage: (language: Language) => void }) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(() => {
    if (typeof window === "undefined") return "";
    const result = sessionStorage.getItem("gems-invite-result") || "";
    sessionStorage.removeItem("gems-invite-result");
    return result;
  });
  const text = ui[language];

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
        setMessage(text.requestSent);
        onDone();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.couldNotContinue);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <div className="setup-card-head"><span /><LanguageToggle language={language} onChange={setLanguage} compact /></div>
        <span className="gem-orbit"><Gem size={30} /></span>
        <p className="kicker">{text.setupKicker}</p>
        <h2>{text.setupTitle}</h2>
        <p className="muted">{text.setupDescription}</p>
        <div className="tabs">
          <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><Plus size={16} /> {text.create}</button>
          <button className={tab === "join" ? "active" : ""} onClick={() => setTab("join")}><Users size={16} /> {text.join}</button>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>{text.circleName}<input name="name" required minLength={2} maxLength={80} placeholder={tab === "create" ? "Sunday Selects" : text.exactCircleName} /></label>
          {tab === "create" && <label>{text.rules} <span>({text.optional})</span><textarea name="rules" maxLength={5000} placeholder={language === "de" ? "Keine Wiederholungen. Überrascht uns." : "No repeats. No guilty pleasures. Surprise us."} /></label>}
          <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : tab === "create" ? <Gem size={17} /> : <Users size={17} />}{tab === "create" ? text.createCircle : text.requestJoin}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  );
}

function UserPanel({ profile, close, language }: { profile: Profile; close: () => void; language: Language }) {
  const [viewedProfile, setViewedProfile] = useState(profile);
  const [stats, setStats] = useState<Record<Emoji, number>>({ "🖤": 0, "❤️": 0, "👍": 0, "👌": 0, "🤔": 0 });
  const [summary, setSummary] = useState({ gems: 0, ratings: 0, points: 0, bestScore: 0 });
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const text = ui[language];

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
    setMessage(error ? error.message : text.passwordUpdated);
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
    if (!publicKey) return setMessage(text.pushNotConfigured);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setMessage(text.pushUnsupported);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setMessage(text.permissionNotGranted);
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
    setMessage(response.ok ? text.browserNotificationsEnabled : text.deviceNotSaved);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="profile-modal">
        <button className="modal-close" onClick={close} aria-label={text.close}><X size={18} /></button>
        <div className="profile-head"><span className="large-avatar">{viewedProfile.nickname.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">{viewedProfile.id === profile.id ? text.yourProfile : text.listenerProfile}</span><h2>{viewedProfile.nickname}</h2></div></div>
        <div className="profile-grid">
          <article>
            <span className="eyebrow">{text.reactionsReceived}</span>
            <h3>{viewedProfile.id === profile.id ? text.yourGemsByFeeling : text.theirGemsByFeeling}</h3>
            <div className="reaction-stats">{ratingOptions.map((item) => <div key={item.emoji}><span>{item.emoji}</span><strong>{stats[item.emoji]}</strong><small>{reactionLabel(language, item.emoji)}</small></div>)}</div>
          </article>
          {viewedProfile.id === profile.id && <article>
            <span className="eyebrow">{text.security}</span>
            <h3>{text.changePassword}</h3>
            <form onSubmit={changePassword} className="form-stack"><label>{text.newPassword}<input name="password" type="password" minLength={8} required placeholder={text.passwordPlaceholder} /></label><button className="primary-button">{text.updatePassword}</button></form>
            <button className="push-button" onClick={enablePush}>{text.enableBrowserNotifications}</button>
          </article>}
        </div>
        <div className="profile-summary"><div><strong>{summary.gems}</strong><small>{language === "de" ? "Gems geteilt" : "gems shared"}</small></div><div><strong>{summary.ratings}</strong><small>{language === "de" ? "Reaktionen gegeben" : "ratings given"}</small></div><div><strong>{summary.points}</strong><small>{language === "de" ? "Punkte erhalten" : "points earned"}</small></div><div><strong>{summary.bestScore}</strong><small>{language === "de" ? "beste Gem-Punktzahl" : "best gem score"}</small></div></div>
        <article className="people-search">
          <span className="eyebrow">{text.community}</span>
          <h3>{text.findListener}</h3>
          <form onSubmit={search}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchByNickname} /><button>{text.search}</button></form>
          {results.length > 0 && <div className="search-results">{results.map((user) => <button type="button" key={user.id} onClick={() => setViewedProfile(user)}><span className="avatar">{user.nickname.slice(0, 1).toUpperCase()}</span><strong>{user.nickname}</strong><span>{text.viewProfile}</span></button>)}</div>}
        </article>
        {message && <p className="form-message">{message}</p>}
      </section>
    </div>
  );
}

function AdminPanel({ group, members, rounds, submissions, close, refresh, notify, language }: {
  group: Group; members: Member[]; rounds: Round[]; submissions: Submission[];
  close: () => void; refresh: () => void; notify: (message: string) => void; language: Language;
}) {
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [savingSetting, setSavingSetting] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [rules, setRules] = useState(group.rules || "");
  const text = ui[language];

  useEffect(() => {
    let active = true;
    supabase.from("group_settings").select("*").eq("group_id", group.id).single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setSettingsError(error?.message || text.couldNotLoadControls);
        else setSettings(data as GroupSettings);
      });
    return () => { active = false; };
  }, [group.id, text.couldNotLoadControls]);

  async function toggle(key: "email_notifications_enabled" | "round_started_email" | "rating_started_email" | "round_completed_email" | "phase_reminder_email" | "auto_start_rounds" | "push_notifications_enabled") {
    if (!settings || savingSetting) return;
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingSetting(key);
    const { error } = await supabase.from("group_settings").update({ [key]: next[key] }).eq("group_id", group.id);
    setSavingSetting(null);
    if (error) { setSettings(previous); notify(error.message); }
    else if (key === "email_notifications_enabled" && next.email_notifications_enabled) await sendTestEmail();
  }

  async function updateInterval(key: "submission_interval_days" | "rating_interval_days", value: number) {
    if (!settings || savingSetting) return;
    const previous = settings;
    const nextValue = Math.max(1, Math.min(14, value));
    setSettings({ ...settings, [key]: nextValue });
    setSavingSetting(key);
    const { error } = await supabase.from("group_settings").update({ [key]: nextValue }).eq("group_id", group.id);
    setSavingSetting(null);
    if (error) { setSettings(previous); notify(error.message); }
    else notify(language === "de" ? "Die Länge künftiger Runden wurde aktualisiert." : "Round length updated for future rounds.");
  }

  async function sendTestEmail() {
    setSendingTest(true);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ groupId: group.id }),
      });
      const result = await response.json() as { error?: string };
      notify(response.ok ? text.testEmailSent : result.error || text.couldNotSendTestEmail);
    } catch {
      notify(text.couldNotSendTestEmail);
    } finally {
      setSendingTest(false);
    }
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
    notify(text.invitationCopied);
  }

  async function changeMember(member: Member, action: "promote" | "remove") {
    const result = action === "promote"
      ? await supabase.from("group_members").update({ role: "admin" }).eq("id", member.id)
      : await supabase.from("group_members").delete().eq("id", member.id);
    if (result.error) notify(result.error.message);
    else { notify(action === "promote" ? text.memberPromoted : text.memberRemoved); refresh(); }
  }

  async function saveRules() {
    const { error } = await supabase.from("groups").update({ rules: rules.trim() || null }).eq("id", group.id);
    if (error) notify(error.message); else { notify(text.rulesUpdated); refresh(); }
  }

  async function archiveGroup() {
    if (!confirm(text.archiveConfirm)) return;
    const { error } = await supabase.from("groups").update({ archived_at: new Date().toISOString() }).eq("id", group.id);
    if (error) notify(error.message); else { notify(text.circleArchived); close(); location.reload(); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="profile-modal admin-modal">
        <button className="modal-close" onClick={close} aria-label={text.close}><X size={18} /></button>
        <div className="profile-head"><span className="large-avatar"><ShieldCheck /></span><div><span className="eyebrow">{text.circleAdministration}</span><h2>{group.name}</h2><p>{members.filter((m) => m.status === "approved").length}/8 {text.members} · {rounds.length} {language === "de" ? "Runden" : "rounds"}</p></div></div>
        <div className="admin-grid">
          <article>
            <span className="eyebrow">{text.automation}</span><h3>{text.costSafeControls}</h3>
            {!settings ? <p className="admin-copy settings-loading">{settingsError || <><LoaderCircle className="spin" size={14} /> {text.loadingControls}</>}</p> : <>{([
              ["email_notifications_enabled", text.emailNotifications, text.emailNotificationsHelp],
              ["round_started_email", text.roundStartedEmail, text.roundStartedEmailHelp],
              ["rating_started_email", text.ratingStartedEmail, text.ratingStartedEmailHelp],
              ["round_completed_email", text.roundCompletedEmail, text.roundCompletedEmailHelp],
              ["phase_reminder_email", text.phaseReminderEmail, text.phaseReminderEmailHelp],
              ["push_notifications_enabled", text.browserPush, text.browserPushHelp],
              ["auto_start_rounds", text.automaticRounds, text.automaticRoundsHelp],
            ] as const).map(([key, title, description]) => (
              <label className="setting-row" key={key}><div><strong>{title}</strong><small>{description}</small></div><input type="checkbox" checked={settings[key]} disabled={Boolean(savingSetting)} onChange={() => toggle(key)} /></label>
            ))}<button className="test-email-button" disabled={!settings.email_notifications_enabled || sendingTest} onClick={sendTestEmail}>{sendingTest ? text.sendingTest : text.sendTestEmail}</button><p className="admin-copy">{text.testEmailHelp}</p></>}
          </article>
          <article>
            <span className="eyebrow">{text.invitations}</span><h3>{text.invitePeople}</h3>
            <p className="admin-copy">{text.inviteHelp}</p>
            <button className="primary-button" onClick={createInvite}><Copy size={15} /> {text.copyInvitation}</button>
            {inviteUrl && <input className="invite-output" value={inviteUrl} readOnly />}
            <div className="usage-summary"><div><strong>{members.length}</strong><small>{text.members}</small></div><div><strong>{rounds.length}</strong><small>{language === "de" ? "Runden" : "rounds"}</small></div><div><strong>{submissions.length}</strong><small>Gems</small></div></div>
            {settings && <div className="interval-settings">
              <span className="eyebrow">{text.futureRounds}</span><h3>{text.listeningRhythm}</h3>
              <p className="admin-copy">{text.intervalHelp}</p>
              <label>{text.choosingInterval}<input type="number" min={1} max={14} disabled={Boolean(savingSetting)} value={settings.submission_interval_days} onChange={(event) => updateInterval("submission_interval_days", Number(event.target.value))} /><small>{text.days}</small></label>
              <label>{text.ratingInterval}<input type="number" min={1} max={14} disabled={Boolean(savingSetting)} value={settings.rating_interval_days} onChange={(event) => updateInterval("rating_interval_days", Number(event.target.value))} /><small>{text.days}</small></label>
            </div>
            }
          </article>
        </div>
        <article className="member-admin">
          <span className="eyebrow">{text.membership}</span><h3>{text.peopleInCircle}</h3>
          {members.filter((member) => member.status === "approved").map((member) => <div key={member.id}><span className="avatar">{member.users?.nickname?.slice(0,1)}</span><strong>{member.users?.nickname}</strong><small>{member.role}</small>{member.role !== "admin" && <><button onClick={() => changeMember(member, "promote")}>{text.makeAdmin}</button><button className="danger-link" onClick={() => changeMember(member, "remove")}>{text.remove}</button></>}</div>)}
        </article>
        <article className="member-admin">
          <span className="eyebrow">{text.circleDetails}</span><h3>{text.rulesAndLifecycle}</h3>
          <textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={5000} placeholder={text.writeRules} />
          <div className="admin-actions"><button className="primary-button" onClick={saveRules}>{text.saveRules}</button><button className="archive-button" onClick={archiveGroup}>{text.archiveCircle}</button></div>
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

function HomePage({ start, language }: { start: () => void; language: Language }) {
  const text = ui[language];
  return (
    <section className="home-page">
      <span className="eyebrow"><Sparkles size={14} /> {text.homeEyebrow}</span>
      <h1>{text.homeTitle}</h1>
      <p>{text.homeDescription}</p>
      <div className="home-principles">
        <article><span>01</span><h2>{text.choosePrivately}</h2><p>{text.choosePrivatelyText}</p></article>
        <article><span>02</span><h2>{text.listenTogether}</h2><p>{text.listenTogetherText}</p></article>
        <article><span>03</span><h2>{text.keepWhatMatters}</h2><p>{text.keepWhatMattersText}</p></article>
      </div>
      <button className="primary-button compact" onClick={start}><Gem size={16} /> {text.goToRound}</button>
    </section>
  );
}

function EmptyRound({ isAdmin, members, start, language }: { isAdmin: boolean; members: Member[]; start: () => void; language: Language }) {
  const text = ui[language];
  return (
    <section className="empty-state">
      <div className="empty-gem"><Gem size={38} /></div>
      <span className="eyebrow">{text.freshCircle}</span>
      <h2>{text.waitingForGems}</h2>
      <p>{members.length < 2 ? text.needFriend : text.circleReady}</p>
      <div className="member-bubbles">{members.map((member) => <span key={member.id} title={member.users?.nickname}>{member.users?.nickname?.slice(0, 1).toUpperCase()}</span>)}</div>
      {isAdmin && <button className="primary-button compact" disabled={members.length < 2} onClick={start}><Sparkles size={17} /> {text.startRound}</button>}
      {!isAdmin && <small>{text.adminStarts}</small>}
    </section>
  );
}

function SongCard({ submission, rating, onRate, isOwn, language }: { submission: Submission; rating?: Emoji; onRate: (emoji: Emoji) => void; isOwn: boolean; language: Language }) {
  const media = provider(submission.song_url);
  const [opened, setOpened] = useState(false);
  const text = ui[language];
  return (
    <article className="song-card">
      <div className="song-heading">
        <div className="music-icon"><Music2 size={19} /></div>
        <div><strong>{submission.title || `${text.songBy} ${submission.users?.nickname || "—"}`}</strong><small>{submission.artist || media?.name || text.musicLink} · {text.chosenBy} {submission.users?.nickname}</small></div>
        {rating && <span className="rated-mark"><Check size={13} /> {text.rated}</span>}
      </div>
      {!opened ? <button className="listen-gate" onClick={() => setOpened(true)}><Play size={22} fill="currentColor" /><span><strong>{text.openPlayer}</strong><small>{text.reactionsUnlock}</small></span></button> :
        media ? <iframe src={media.embed} title={`${media.name} player`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> :
          <a className="external-song" href={submission.song_url} target="_blank" rel="noreferrer">{text.openSong} <ChevronRight size={15} /></a>}
      <a className="source-link" href={submission.song_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
        {text.openOriginal} {media?.name || text.musicSite} <ChevronRight size={13} />
      </a>
      {isOwn ? <p className="own-submission-note">{text.ownSong}</p> : <div className="rating-row">
        {ratingOptions.map((option) => (
          <button key={option.emoji} disabled={!opened} className={rating === option.emoji ? "selected" : ""} onClick={() => onRate(option.emoji)} title={opened ? `${reactionLabel(language, option.emoji)} · ${option.points} ${text.points}` : text.openBeforeReacting}>
            <span>{option.emoji}</span><small>{option.points}pt</small>
          </button>
        ))}
      </div>}
      {!isOwn && !opened && <small className="rating-lock-note">{text.openBeforeReacting}</small>}
    </article>
  );
}

function OwnSubmissionPreview({ submission, language }: { submission: Submission; language: Language }) {
  const media = provider(submission.song_url);
  const text = ui[language];
  return (
    <article className="own-submission-preview">
      {submission.thumbnail_url
        ? <span className="own-submission-art" role="img" aria-label="" style={{ backgroundImage: `url("${submission.thumbnail_url}")` }} />
        : <span className="own-submission-art fallback"><Music2 size={22} /></span>}
      <div>
        <small>{text.yourSubmittedSong}</small>
        <strong>{submission.title || media?.name || text.musicLink}</strong>
        {submission.artist && <span>{submission.artist}</span>}
        <p><Check size={14} /> {text.currentLinkHidden}</p>
      </div>
      <a href={submission.song_url} target="_blank" rel="noopener noreferrer" aria-label={`${text.openOriginal} ${media?.name || text.musicSite}`}>
        {media?.name || text.openSong} <ChevronRight size={15} />
      </a>
    </article>
  );
}

function Dashboard({ session, language, setLanguage }: { session: Session; language: Language; setLanguage: (language: Language) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [circleOverviews, setCircleOverviews] = useState<Record<string, CircleOverview>>({});
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
  const text = ui[language];

  const loadGroups = useCallback(async () => {
    const { data: me } = await supabase.from("users").select("*").eq("id", session.user.id).maybeSingle();
    setProfile(me);
    setProfileMissing(!me);
    const { data: memberships } = await supabase.from("group_members").select("group_id,status").eq("user_id", session.user.id);
    const approvedIds = (memberships || []).filter((m) => m.status === "approved").map((m) => m.group_id);
    if (approvedIds.length) {
      const [{ data }, { data: roundData }, { data: overviewMemberData }] = await Promise.all([
        supabase.from("groups").select("*").in("id", approvedIds).is("archived_at", null).order("created_at"),
        supabase.from("rounds").select("*").in("group_id", approvedIds).order("round_number", { ascending: false }),
        supabase.from("group_members").select("group_id,user_id").in("group_id", approvedIds).eq("status", "approved"),
      ]);
      const availableGroups = (data || []) as Group[];
      const availableIds = new Set(availableGroups.map((item) => item.id));
      const latestRounds = new Map<string, Round>();
      for (const round of (roundData || []) as Round[]) {
        if (availableIds.has(round.group_id) && !latestRounds.has(round.group_id)) latestRounds.set(round.group_id, round);
      }
      const currentRoundIds = [...latestRounds.values()].map((round) => round.id);
      const [{ data: overviewSubmissions }, { data: overviewRatings }] = currentRoundIds.length
        ? await Promise.all([
            supabase.from("submissions").select("id,group_id,round_id,user_id").in("round_id", currentRoundIds),
            supabase.from("ratings").select("group_id,round_id,submission_id,user_id").in("round_id", currentRoundIds),
          ])
        : [{ data: [] }, { data: [] }];
      const overviews: Record<string, CircleOverview> = {};
      for (const item of availableGroups) {
        const round = latestRounds.get(item.id) || null;
        const approvedUserIds = new Set((overviewMemberData || []).filter((member) => member.group_id === item.id).map((member) => member.user_id));
        const roundSubmissions = (overviewSubmissions || []).filter((submission) => submission.round_id === round?.id && approvedUserIds.has(submission.user_id));
        const submissionIds = new Set(roundSubmissions.map((submission) => submission.id));
        const eligibleRatingTotal = [...approvedUserIds].reduce(
          (total, userId) => total + roundSubmissions.filter((submission) => submission.user_id !== userId).length,
          0,
        );
        const ratingCount = (overviewRatings || []).filter((rating) => (
          rating.round_id === round?.id
          && approvedUserIds.has(rating.user_id)
          && submissionIds.has(rating.submission_id)
          && roundSubmissions.some((submission) => submission.id === rating.submission_id && submission.user_id !== rating.user_id)
        )).length;
        overviews[item.id] = {
          round,
          memberCount: approvedUserIds.size,
          submissionCount: roundSubmissions.length,
          ratingCount,
          eligibleRatingTotal,
        };
      }
      setGroups(availableGroups);
      setCircleOverviews(overviews);
      setSelectedId((current) => {
        let saved = "";
        try { saved = localStorage.getItem(`gems:selected-circle:${session.user.id}`) || ""; } catch {}
        if (current && availableIds.has(current)) return current;
        return availableIds.has(saved) ? saved : availableGroups[0]?.id || "";
      });
    } else {
      setGroups([]);
      setCircleOverviews({});
      setSelectedId("");
    }
    setLoading(false);
  }, [session.user.id]);

  const loadGroup = useCallback(async () => {
    if (!selectedId) return;
    const [{ data: memberData }, { data: roundData }, { data: settingData }] = await Promise.all([
      supabase.from("group_members").select("*,users!group_members_user_id_fkey(id,nickname)").eq("group_id", selectedId).order("created_at"),
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
    if (profileMissing) void supabase.auth.signOut();
  }, [profileMissing]);
  useEffect(() => {
    if (!selectedId) return;
    try { localStorage.setItem(`gems:selected-circle:${session.user.id}`, selectedId); } catch {}
  }, [selectedId, session.user.id]);
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

  async function sendRoundEmail(event: "round_started" | "rating_started" | "round_completed", roundId: string, timeMachine = false) {
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/notifications/round-event", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ groupId: selectedId, roundId, event, timeMachine }),
      });
      const result = await response.json() as { failed?: number; skipped?: boolean };
      return response.ok && !result.failed && !result.skipped;
    } catch {
      // The daily server check remains a fallback if an immediate request is interrupted.
      return false;
    }
  }

  async function startRound() {
    if (!group) return;
    const previous = rounds[0];
    const starts = new Date();
    const submissionEnd = new Date(starts.getTime() + intervals.submission * 86400000);
    const ratingEnd = new Date(submissionEnd.getTime() + intervals.rating * 86400000);
    const { data: createdRound, error } = await supabase.from("rounds").insert({
      group_id: group.id,
      round_number: (previous?.round_number || 0) + 1,
      starts_at: starts.toISOString(),
      submission_ends_at: submissionEnd.toISOString(),
      rating_ends_at: ratingEnd.toISOString(),
    }).select("id").single();
    if (error) setNotice(error.message); else {
      const emailSent = await sendRoundEmail("round_started", createdRound.id);
      setNotice(emailSent ? text.newRoundStarted : `${text.newRoundStarted} ${text.phaseEmailFailed}`);
      loadGroup();
    }
  }

  async function saveSubmission(event: FormEvent) {
    event.preventDefault();
    if (!currentRound || !provider(songUrl)) {
      setNotice(text.invalidSongUrl);
      return;
    }
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ groupId: selectedId, roundId: currentRound.id, url: songUrl.trim() }),
      });
      const result = await response.json() as { submission?: Submission; error?: string; code?: string };
      if (!response.ok || !result.submission) {
        setNotice(result.code === "DUPLICATE_SONG"
          ? text.duplicateSong
          : result.code === "SUBMISSION_CLOSED"
            ? text.submissionClosed
            : result.code === "INVALID_SONG"
              ? text.invalidSongUrl
              : text.somethingWrong);
        return;
      }
      const savedSubmission = result.submission;
      const saved = { ...(savedSubmission as Submission), users: profile };
      setSubmissions((items) => [
        ...items.filter((item) => item.id !== saved.id && !(item.round_id === saved.round_id && item.user_id === saved.user_id)),
        saved,
      ]);
      setSongUrl("");
      setNotice(mySubmission ? text.songUpdated : text.songLocked);
      void loadGroup();
    } catch {
      setNotice(text.somethingWrong);
    }
  }

  async function rate(submissionId: string, emoji: Emoji) {
    if (!currentRound) return;
    const submission = currentSubmissions.find((item) => item.id === submissionId);
    if (!submission || submission.user_id === session.user.id) {
      setNotice(text.cannotRateOwn);
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
      setNotice(text.allMustSubmit);
      return;
    }
    if (phase === "rate" && !allRated) {
      setNotice(text.allMustReact);
      return;
    }
    if (!confirm(phase === "submit" ? text.confirmEndChoosing : text.confirmEndRating)) return;
    const { error } = await supabase.rpc("complete_round_phase", { target_round_id: currentRound.id });
    if (error) setNotice(error.message);
    else {
      const emailSent = phase === "submit"
        ? await sendRoundEmail("rating_started", currentRound.id)
        : await sendRoundEmail("round_completed", currentRound.id);
      const phaseNotice = phase === "submit" ? text.choosingComplete : text.ratingComplete;
      setNotice(emailSent ? phaseNotice : `${phaseNotice} ${text.phaseEmailFailed}`);
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
    if (!group || !confirm(text.leaveConfirm.replace("{name}", group.name))) return;
    const { error } = await supabase.rpc("leave_group", { target_group_id: group.id });
    if (error) setNotice(error.message);
    else { setNotice(text.leftCircle); setSelectedId(""); await loadGroups(); }
  }

  async function fastForward(days: number) {
    if (!currentRound) return;
    if (!confirm(text.timeMachineConfirm.replace("{days}", String(days)))) return;
    const shift = (iso: string) => new Date(new Date(iso).getTime() - days * 86400000).toISOString();
    const shiftedRound = {
      ...currentRound,
      starts_at: shift(currentRound.starts_at),
      submission_ends_at: shift(currentRound.submission_ends_at),
      rating_ends_at: shift(currentRound.rating_ends_at),
    };
    const { error } = await supabase.from("rounds").update({
      starts_at: shiftedRound.starts_at,
      submission_ends_at: shiftedRound.submission_ends_at,
      rating_ends_at: shiftedRound.rating_ends_at,
    }).eq("id", currentRound.id);
    if (error) setNotice(error.message);
    else {
      const nextPhase = phaseOf(shiftedRound);
      const transitionedEvent = nextPhase === "reveal" && phase !== "reveal"
        ? "round_completed"
        : nextPhase === "rate" && phase === "submit"
          ? "rating_started"
          : null;
      const emailSent = transitionedEvent ? await sendRoundEmail(transitionedEvent, currentRound.id, true) : true;
      const movedNotice = text.timeMoved.replace("{days}", String(days));
      setNotice(emailSent ? movedNotice : `${movedNotice} ${text.phaseEmailFailed}`);
      await loadGroup();
    }
  }

  async function skipToNextPhase() {
    if (!currentRound || (phase !== "submit" && phase !== "rate")) return;
    if (!confirm(text.timeMachinePhaseConfirm)) return;
    const now = new Date();
    const update = phase === "submit"
      ? {
          submission_ends_at: now.toISOString(),
          rating_ends_at: new Date(now.getTime() + (new Date(currentRound.rating_ends_at).getTime() - new Date(currentRound.submission_ends_at).getTime())).toISOString(),
        }
      : { rating_ends_at: now.toISOString() };
    const { error } = await supabase.from("rounds").update(update).eq("id", currentRound.id);
    if (error) setNotice(error.message);
    else {
      const emailSent = await sendRoundEmail(phase === "submit" ? "rating_started" : "round_completed", currentRound.id, true);
      setNotice(emailSent ? text.timeMachinePhaseMoved : `${text.timeMachinePhaseMoved} ${text.phaseEmailFailed}`);
      await loadGroup();
    }
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
    if (!response.ok) setNotice(result.error || text.couldNotCreateDummyData);
    else {
      setNotice(text.dummyDataAdded);
      await loadGroup();
    }
  }

  if (loading) return <div className="full-loader"><Gem className="pulse" size={34} /><span>{text.loading}</span></div>;
  if (!profile) return <div className="full-loader"><Gem className="pulse" size={34} /><span>{text.loading}</span></div>;
  if (!groups.length) return (
    <div className="app-bg">
      <header className="topbar"><Logo /><div className="user-menu"><LanguageToggle language={language} onChange={setLanguage} compact /><span>{profile.nickname}</span><button onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button></div></header>
      <GroupSetup language={language} setLanguage={setLanguage} onDone={loadGroups} />
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
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><House size={16} /> {text.home}</button>
          <button className={view === "round" ? "active" : ""} onClick={() => setView("round")}><Gem size={16} /> {text.currentRound}</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><History size={16} /> {text.history}</button>
        </nav>
        <div className="user-menu">
          <LanguageToggle language={language} onChange={setLanguage} compact />
          <span className="avatar">{profile.nickname.slice(0, 1).toUpperCase()}</span>
          <span>{profile.nickname}</span>
          <button onClick={() => setShowProfile(true)} aria-label={text.openProfile}><UserRound size={17} /></button>
          {isPlatformAdmin && <button onClick={() => setShowPlatformAdmin(true)} aria-label={text.openDeveloperConsole}><Settings2 size={17} /></button>}
          <button onClick={() => supabase.auth.signOut()} aria-label={text.signOut}><LogOut size={17} /></button>
        </div>
      </header>
      {notice && <Notice message={notice} clear={() => setNotice("")} />}
      {showProfile && <UserPanel profile={profile} close={() => setShowProfile(false)} language={language} />}
      {showAdmin && group && <AdminPanel key={group.id} group={group} members={members} rounds={rounds} submissions={submissions} close={() => setShowAdmin(false)} refresh={() => { loadGroups(); loadGroup(); }} notify={setNotice} language={language} />}
      {showPlatformAdmin && <PlatformAdminPanel close={() => setShowPlatformAdmin(false)} />}
      {showGroupSetup && <div className="modal-backdrop"><div className="group-modal"><button className="modal-close" onClick={() => setShowGroupSetup(false)}><X size={18} /></button><GroupSetup language={language} setLanguage={setLanguage} onDone={() => { setShowGroupSetup(false); loadGroups(); }} /></div></div>}
      <main className="dashboard">
        <aside>
          <p className="sidebar-label">{text.yourCircles}</p>
          {groups.map((item) => {
            const overview = circleOverviews[item.id];
            const overviewPhase = phaseOf(overview?.round || null);
            const progressValue = overviewPhase === "submit" ? overview?.submissionCount || 0 : overviewPhase === "rate" ? overview?.ratingCount || 0 : overviewPhase === "reveal" ? 1 : 0;
            const progressTotal = overviewPhase === "submit" ? overview?.memberCount || 0 : overviewPhase === "rate" ? overview?.eligibleRatingTotal || 0 : overviewPhase === "reveal" ? 1 : 0;
            const progressPercent = progressTotal ? Math.min(100, (progressValue / progressTotal) * 100) : 0;
            const phaseLabel = overviewPhase === "submit" ? text.choosing : overviewPhase === "rate" ? text.listening : overviewPhase === "reveal" ? text.roundComplete : text.noRoundYet;
            const overviewTarget = overviewPhase === "submit" ? overview?.round?.submission_ends_at : overviewPhase === "rate" ? overview?.round?.rating_ends_at : undefined;
            return <button key={item.id} className={item.id === selectedId ? "group-link active" : "group-link"} onClick={() => setSelectedId(item.id)}>
              <span>{item.name.slice(0, 1)}</span>
              <div className="group-link-summary">
                <div className="group-link-title"><strong>{item.name}</strong><b className={`circle-phase ${overviewPhase}`}>{phaseLabel}</b></div>
                <div className="circle-round-time">
                  <small>{overview?.round ? `${text.round} ${overview.round.round_number}` : `${overview?.memberCount || 0} ${text.members}`}</small>
                  {overviewTarget && <small className="circle-time"><Clock3 size={9} /> {countdown(overviewTarget, language)}</small>}
                </div>
                {overviewPhase !== "empty" && <div className="circle-progress"><span><i style={{ width: `${progressPercent}%` }} /></span><b>{overviewPhase === "reveal" ? "✓" : `${progressValue}/${progressTotal}`}</b></div>}
              </div>
            </button>;
          })}
          <button className="new-group" onClick={() => setShowGroupSetup(true)}><Plus size={16} /> {text.newCircle}</button>
        </aside>
        <div className="main-column">
          {view === "home" && <HomePage start={() => setView("round")} language={language} />}
          {view !== "home" && <section className="group-hero">
            <div>
              <span className="eyebrow"><Gem size={13} /> {text.listeningCircle}</span>
              <h1>{group?.name}</h1>
              {group?.rules && <p>“{group.rules}”</p>}
            </div>
            <div className="hero-meta">
              {currentRound && <span>{text.round} {currentRound.round_number}</span>}
              <span><Users size={15} /> {approved.length}/8</span>
              <button onClick={leaveGroup} title={text.leaveCircle}><LogOut size={16} /></button>
              {isAdmin && <button className="admin-entry" onClick={() => setShowAdmin(true)} title={text.circleAdministration}><ShieldCheck size={17} /><span>{text.admin}</span></button>}
              {isAdmin && <button onClick={() => setShowSettings(!showSettings)} title={text.timeMachine}><Settings2 size={17} /></button>}
            </div>
          </section>}

          {view === "round" && pending.length > 0 && isAdmin && (
            <section className="admin-card">
              <div><ShieldCheck size={19} /><div><strong>{pending.length} {pending.length > 1 ? text.joinRequests : text.joinRequest}</strong><small>{text.privateUntilApproved}</small></div></div>
              {pending.map((member) => <div className="request-row" key={member.id}><span className="avatar">{member.users?.nickname?.slice(0, 1).toUpperCase()}</span><strong>{member.users?.nickname}</strong><button onClick={() => approve(member, "rejected")} className="ghost-button">{text.decline}</button><button onClick={() => approve(member, "approved")} className="small-button">{text.approve}</button></div>)}
            </section>
          )}

          {view === "round" && showSettings && isAdmin && (
            <section className="dev-card">
              <div><Settings2 size={18} /><div><strong>{text.timeMachine}</strong><small>{text.adminOnlyTimeMachine}</small></div></div>
              <div>{[1, 5, 12].map((days) => <button key={days} onClick={() => fastForward(days)}>+{days} {text.days}</button>)}</div>
              {phase === "submit" && <button onClick={skipToNextPhase}>{text.timeMachineSkipToListening}</button>}
              {phase === "rate" && <button onClick={skipToNextPhase}>{text.timeMachineSkipToResults}</button>}
              {process.env.NODE_ENV === "development" && <button onClick={seedDummyData}>{text.addDummyData}</button>}
            </section>
          )}

          {view === "round" && phase === "empty" && <EmptyRound isAdmin={isAdmin} members={approved} start={startRound} language={language} />}

          {view === "round" && phase !== "empty" && (
            <section className="round-status">
              <div className={`phase-step ${phase === "submit" ? "active" : "done"}`}><span>{phase === "submit" ? "1" : <Check size={15} />}</span><div><strong>{text.submit}</strong><small>{text.choosing}</small></div></div>
              <i />
              <div className={`phase-step ${phase === "rate" ? "active" : phase === "reveal" ? "done" : ""}`}><span>{phase === "reveal" ? <Check size={15} /> : "2"}</span><div><strong>{text.rate}</strong><small>{text.listening}</small></div></div>
              <i />
              <div className={`phase-step ${phase === "reveal" ? "active" : ""}`}><span>3</span><div><strong>{text.revealPhase}</strong><small>{text.revealWhenClosed}</small></div></div>
              {phase !== "reveal" && <div className="countdown"><Clock3 size={16} /><strong>{countdown(phaseTarget, language)}</strong><small>{text.utcCountdown}</small></div>}
            </section>
          )}

          {view === "round" && phase === "submit" && (
            <section className="content-card submit-card">
              <div className="section-title"><div><span className="eyebrow">{text.submissionPhase}</span><h2>{mySubmission ? text.yourGemIn : text.whatsYourGem}</h2><p>{mySubmission ? text.swapAnytime : text.shareTrack}</p></div><ProgressRing value={currentSubmissions.length} total={approved.length} label={text.submit.toLowerCase()} /></div>
              <form onSubmit={saveSubmission} className="song-form">
                <Music2 size={18} />
                <input value={songUrl} onChange={(e) => setSongUrl(e.target.value)} placeholder={mySubmission ? text.pasteNewMusic : text.pasteMusic} required />
                <button>{mySubmission ? text.swapGem : text.submitGem} <ChevronRight size={16} /></button>
              </form>
              <p className="provider-shortcuts">{text.needGem} <a href="https://open.spotify.com/" target="_blank" rel="noreferrer">Spotify</a>{language === "de" ? " oder " : " or "}<a href="https://www.youtube.com/" target="_blank" rel="noreferrer">YouTube</a>, {text.pasteLink}</p>
              {mySubmission && <OwnSubmissionPreview submission={mySubmission} language={language} />}
              <div className="member-progress">
                {approved.map((member) => {
                  const done = currentSubmissions.some((item) => item.user_id === member.user_id);
                  return <div key={member.id} className={done ? "done" : ""}><span>{member.users?.nickname?.slice(0, 1).toUpperCase()}</span><strong>{member.users?.nickname}</strong><small>{done ? text.songAdded : text.choosingSong}</small>{done && <Check size={14} />}</div>;
                })}
              </div>
              {isAdmin && currentSubmissions.length === approved.length && approved.length > 0 && <div className="phase-complete-action"><div><Check size={18} /><span><strong>{text.allSongsIn}</strong><small>{text.openRating}</small></span></div><button className="primary-button compact" onClick={endCurrentPhase}>{text.endChoosing}</button></div>}
            </section>
          )}

          {view === "round" && phase === "rate" && (
            <section className="rating-section">
              <div className="section-title"><div><span className="eyebrow">{text.gemsUnlocked}</span><h2>{text.listenWithIntention}</h2><p>{text.ratingDescription}</p></div><ProgressRing value={currentRatings.length} total={eligibleRatingTotal} label={text.circleRatings} /></div>
              <div className="rating-legend">{ratingOptions.map((item) => <span key={item.emoji}><b>{item.emoji}</b>{item.points} {text.points} · {reactionLabel(language, item.emoji)}</span>)}</div>
              <div className="song-grid">{currentSubmissions.map((submission) => <SongCard key={submission.id} submission={submission} rating={myRatings.find((rating) => rating.submission_id === submission.id)?.emoji} onRate={(emoji) => rate(submission.id, emoji)} isOwn={submission.user_id === session.user.id} language={language} />)}</div>
              {isAdmin && eligibleRatingTotal > 0 && currentRatings.length === eligibleRatingTotal && <div className="phase-complete-action"><div><Check size={18} /><span><strong>{text.allReactionsIn}</strong><small>{text.revealResultsNow}</small></span></div><button className="primary-button compact" onClick={endCurrentPhase}>{text.endRating}</button></div>}
            </section>
          )}

          {view === "round" && phase === "reveal" && (
            <section className="reveal-card">
              <span className="eyebrow"><Sparkles size={14} /> {text.roundComplete}</span>
              <h2>{text.brightestGems}</h2>
              <p>{text.revealDescription}</p>
              <div className="podium">
                {leaderboard.map((item, index) => <article key={item.id} className={index === 0 ? "winner" : ""}><span className="rank">{index + 1}</span><div className="cover"><Gem size={index === 0 ? 30 : 22} /></div><div><strong>{text.songBy} {item.users?.nickname}</strong><a href={item.song_url} target="_blank" rel="noreferrer">{provider(item.song_url)?.name || text.openSong} <ChevronRight size={13} /></a><span className="reactions">{item.reactions.map((reaction) => <b key={reaction.id}>{reaction.emoji}</b>)}</span></div><strong className="score">{item.points}<small>{text.points}</small></strong></article>)}
              </div>
              {isAdmin && <button className="primary-button compact" onClick={startRound}><Sparkles size={16} /> {text.startNextRound}</button>}
            </section>
          )}

          {view === "history" && <section id="history" className="history-section history-page">
            <div className="section-title"><div><span className="eyebrow">{text.vault}</span><h2>{text.listeningHistory}</h2></div></div>
            {rounds.filter((round) => phaseOf(round) === "reveal").length === 0 ? <div className="history-empty"><History size={24} /><span>{text.noHistory}</span></div> :
              rounds.filter((round) => phaseOf(round) === "reveal").map((round) => {
                const songs = submissions.filter((item) => item.round_id === round.id).map((song) => ({
                  ...song,
                  reactions: ratings.filter((rating) => rating.submission_id === song.id),
                  score: ratings.filter((rating) => rating.submission_id === song.id).reduce((sum, rating) => sum + rating.points, 0),
                })).sort((a, b) => b.score - a.score);
                return <div className="history-entry" key={round.id}><button className="history-row" onClick={() => setExpandedRound(expandedRound === round.id ? null : round.id)}><span><Gem size={17} /></span><div><strong>{text.round} {round.round_number}</strong><small>{new Date(round.starts_at).toLocaleDateString(language, { month: "long", day: "numeric", year: "numeric" })}</small></div><div>{songs.length} Gems</div><ChevronRight className={expandedRound === round.id ? "rotate" : ""} size={17} /></button>{expandedRound === round.id && <div className="history-detail">{songs.map((song, index) => <div key={song.id}><span>#{index + 1}</span>{song.thumbnail_url ? <span className="history-art" role="img" aria-label="" style={{ backgroundImage: `url("${song.thumbnail_url}")` }} /> : <span className="mini-cover"><Music2 size={15} /></span>}<div><strong>{song.title || `${text.songBy} ${song.users?.nickname || "—"}`}</strong><small>{song.artist || song.users?.nickname}</small></div><span className="history-reactions">{song.reactions.map((reaction) => reaction.emoji).join(" ")}</span><b>{song.score} {text.points}</b><a href={song.song_url} target="_blank" rel="noreferrer"><ChevronRight size={15} /></a></div>)}</div>}</div>;
              })}
          </section>}
        </div>
      </main>
      <nav className="mobile-nav">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><House size={18} /><span>{text.home}</span></button>
        <button className={view === "round" ? "active" : ""} onClick={() => setView("round")}><Gem size={18} /><span>{text.currentRound}</span></button>
        <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><History size={18} /><span>{text.history}</span></button>
        <button onClick={() => setShowGroupSetup(true)}><Plus size={18} /><span>{text.newCircle}</span></button>
        <button onClick={() => setShowProfile(true)}><UserRound size={18} /><span>{text.profile}</span></button>
        {isAdmin && <button onClick={() => setShowAdmin(true)}><ShieldCheck size={18} /><span>{text.admin}</span></button>}
      </nav>
    </div>
  );
}

export function GemsApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [language, setLanguage] = useState<Language>("en");
  const languageLoaded = useRef(false);
  const inviteRedemptionStarted = useRef(false);
  useEffect(() => {
    if (!languageLoaded.current) {
      languageLoaded.current = true;
      const saved = localStorage.getItem("gems-language");
      if ((saved === "de" || saved === "en") && saved !== language) {
        const restoreLanguage = window.setTimeout(() => setLanguage(saved), 0);
        return () => window.clearTimeout(restoreLanguage);
      }
    }
    localStorage.setItem("gems-language", language);
    document.documentElement.lang = language;
  }, [language]);
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
    if (!token || inviteRedemptionStarted.current) return;
    inviteRedemptionStarted.current = true;
    supabase.rpc("join_group_by_invite", { invite_token: token }).then(({ error }) => {
      sessionStorage.setItem("gems-invite-result", error ? error.message : "Invitation accepted. The circle admin can now approve you.");
      history.replaceState({}, "", location.pathname);
      location.reload();
    });
  }, [session]);
  if (session === undefined) return <div className="full-loader"><Gem className="pulse" size={34} /><span>{ui[language].loading}</span></div>;
  return session ? <Dashboard session={session} language={language} setLanguage={setLanguage} /> : <AuthScreen language={language} setLanguage={setLanguage} />;
}
