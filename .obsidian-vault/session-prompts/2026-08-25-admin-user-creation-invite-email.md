# Session kickoff prompt — Admin-created users + invite email, self-signup removal

Paste this into a new Claude Code session in `C:\RFT\Projects\CRM`:

---

Read the vault first: `.obsidian-vault/index.md`, `project-status.md`, and
`.obsidian-vault/meetings/2026-08-25-client-callback-new-asks.md`. Also read
`src/views/auth/LoginView.vue`, `src/stores/auth.ts`, `src/services/auth.service.ts`,
`src/views/auth/SignupView.vue`, `src/views/auth/CompleteInviteView.vue`, and `src/views/UsersView.vue`
before changing anything.

## Why this session

The client does **not** want self-service signup — confirmed directly (Stan removed the "Account
aanmaken" link from `LoginView.vue` last session on explicit instruction). But the codebase still has
two half-finished, overlapping account-creation paths from before that was clear:

1. **Self-signup** (`SignupView.vue`, `authStore.signUp()`) — creates its own Auth account + pending
   `/users/{uid}` doc. The login-page entry point is gone, but the route, view, and store method are
   all still live and reachable directly by URL. Client doesn't want this at all — it should probably
   come out entirely, not just lose its link.
2. **Admin-triggered invite email** (`UsersView.vue`'s "Nieuwe medewerker uitnodigen" panel,
   `authService.sendInvite()`, `CompleteInviteView.vue`) — this is the flow the client actually wants:
   admin creates/invites a user, they get an email, they set their own password and land as pending
   for admin approval. **Built and pushed, but never verified working** — Stan tested it live and got
   400s from `identitytoolkit.googleapis.com`, root-caused to "Email link" sign-in still being **off**
   in the Firebase Console (Authentication → Sign-in method). That's a console toggle, not something
   Claude can flip — needs Stan to do it before this can be tested end-to-end.

## Concretely, this session

1. **Confirm with Stan, then rip out self-signup entirely** if confirmed: `SignupView.vue`, the
   `/signup` route, `authStore.signUp()`, `authService.signUp()`, and the office-picker self-signup
   plumbing in `usersService.createProfile()` (check whether `CompleteInviteView`/`completeInvite()`
   also calls `createProfile()` — it does, per `project-status.md` — so don't delete the function, only
   the self-signup call site and the now-dead `SignupView`/route). Check `firestore.rules` for any rule
   written specifically to allow a client-side create tied to self-signup vs. invite-completion; they
   may currently share a rule that needs to stay for the invite path.
2. **Verify the admin-invite flow actually works**, once Stan has flipped the Firebase Console toggle:
   - Admin sends invite from `UsersView.vue` → real email arrives → click through → `CompleteInviteView`
     → account created, lands as pending → shows up in `UsersView` for role assignment.
   - Test this for real (ask Stan to check the inbox, or use a test address he controls) — don't just
     read the code and assume it works given it already failed live once.
3. **Decide what "creating a user" means for admins now that self-signup is gone**: is invite-by-email
   the *only* way a new account gets created, or does the client also want a plain "create this
   person's account right now with a temp password" option (no email round-trip)? Not decided anywhere
   in the vault — ask Stan/the client rather than assuming.
4. Fold in the small related ask from the 2026-08-25 client callback note if still open by then: item 1
   (click-to-call `tel:` links) is unrelated but cheap — worth doing in the same session if there's room,
   not a blocker either way.

## Landmines from last session, still relevant

- The login screen was restyled this session (black header w/ logo, radial-gradient glow, pink accent
  line) — don't revert that while touching `LoginView.vue`; the removed "Account aanmaken" link is the
  only structural change intended there so far, the rest was pure visual work.
- A 7-day "Aangemeld blijven" (remember me) session-expiry feature was added to `stores/auth.ts` this
  session (`SESSION_TTL_MS`, `LOGIN_AT_KEY`, `REMEMBER_KEY`, `isSessionExpired()`) — unrelated to this
  session's scope but touches the same file; don't clobber it while editing `signIn`/`hydrate`.
- Local Firestore emulator is still broken on this machine (JDK21/Windows loopback bug per
  `project-status.md`) — any `firestore.rules` change needs prod deploy + live verification, same
  discipline as every prior session (audit before deploy, confirm with Stan first).
- Two prior near-lockout incidents this project (documented in `project-status.md`) came from
  role/claims changes deployed without checking existing accounts first — if this session's self-signup
  removal touches `firestore.rules`, re-check both admin accounts still resolve correctly before calling
  it done.

Typecheck (`npx vue-tsc --noEmit`) and run `npm test` before calling anything done — Stan asked to hold
off on running the test suite mid-session last time, but it should run before this next session wraps.
Update `project-status.md` and this vault as you go, same conventions as always.
