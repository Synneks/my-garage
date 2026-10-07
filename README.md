# Bandit · Maintenance Log

An English and Romanian app for the 2005 Suzuki GSF650S Bandit (K5), built with **React, TypeScript, Vite, Tailwind, and shadcn/ui**. Firebase Authentication (Google) and Cloud Firestore provide authentication and synchronization. The frontend can be deployed to GitHub Pages; no Node server or Docker is required in production.

Initial odometer reading: **30,920 km**. Data from the previous version is automatically preserved at the same URL in the same browser.

## Getting started

Use Node.js **22.12+** (or 20.19+) and **Java 21+**. Java is needed only for local emulators and security-rule tests. The launcher also detects a JRE under `.runtime/jdk-21*/bin`.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4174 and click **Conectare cont de test**. One command starts Auth, Firestore, the emulator UI, and Vite, and creates a synthetic notebook for `bandit@example.test`. No Firebase login or real project is required for local development. The first run may download the emulator binaries.

Local endpoints: app **4174**, Firestore **8080**, Auth **9199**, emulator UI **4000**, hub **4410**, logs **4510**, Firestore websocket **9150**. These Auth/hub/logging ports allow coexistence with the previous emulator setup. An occupied port stops startup; the launcher never reuses or clears another server.

Press **Ctrl+C once**, then wait for export and shutdown. Auth and Firestore data are saved in the ignored `.runtime/emulator-data` directory and restored on the next run. Forced termination may lose changes since the last export. Startup seeds only missing notebooks; it does not overwrite your test edits.

```sh
# With the development stack stopped:
npm run dev:reset
npm run dev

# Synthetic CSVs for local or staging import:
npm run mock:csv
```

Reset removes only this worktree's emulator snapshot. On the next start, use the test sign-in button again if your browser has retained the old session. Signed-out browser data is separate; reset does not erase it.

The fixtures cover overdue and upcoming work, unconfirmed history, custom intervals, planned milestones, and empty history. CSVs are written to `.runtime/fixtures/realistic.csv` and `empty.csv`. Records are synthetic; no production database is read.

## Environment profiles

| Environment          | Command                 | Services                                                        |
| -------------------- | ----------------------- | --------------------------------------------------------------- |
| Local                | `npm run dev`           | `demo-my-garage-local`, Auth + Firestore emulators              |
| Staging on localhost | `npm run dev:staging`   | Separate `my-garage-staging` Firebase project; app on port 4176 |
| Production build     | `npm run build`         | Existing `my-garage-981e8` project                              |
| Staging build        | `npm run build:staging` | Separate staging Firebase project                               |
| CI compilation       | `npm run build:check`   | Fake staging Web configuration; artifact is verification-only   |

`dev:emulator` and `emulators` are aliases for the combined local launcher. The app displays a persistent test-environment banner in local and staging modes.

Production settings belong in `.env.production.local`; staging settings belong in `.env.staging.local`. Copy `.env.example` or `.env.staging.example` respectively. Local development has complete safe defaults; `.env.emulator.local` is optional, using `.env.emulator.example` as its template.

If you already have Firebase settings in `.env.local`, **rename it to `.env.production.local` and add `VITE_APP_ENV=production`**. Generic `.env`/`.env.local` Firebase settings are rejected so Vite cannot silently inherit production values. Shell variables still have priority and are validated. Restart the server after changing settings.

The environment validator pins each mode to its intended project, rejects missing values, prohibits production development servers, and prohibits emulator builds. Project IDs are public constants in `src/lib/environment.js`. The cloud staging project `my-garage-staging` is registered separately from production.

`npm run preview` serves a staging build on port 4177. Run `npm run build:staging` first; preview refuses production artifacts. `build:check` artifacts cannot authenticate and must not be deployed.

## Features

- Dashboard with priorities and upcoming milestones.
- 38 maintenance tasks, with replacements and inspections calculated separately.
- History with dates, odometer readings, notes, and confirmation of completed work; add, edit, delete, and undo the last change.
- Due dates based on mileage **or** time, whichever comes first.
- Custom intervals, planned milestones, and editable priorities.
- Search and filters; mobile-friendly interface.
- Complete CSV backups and validated imports with a preview.
- Google sign-in, Firestore synchronization, and protection against concurrent changes.

## Firebase setup

Production remains the existing **my-garage-981e8** Firebase project. The frontend still uses Firebase Authentication (Google) and the default Firestore database; GitHub Pages serves only static files.

For a cloud test environment, use **My Garage Staging**, project **my-garage-staging**, with these settings:

1. Keep the **Spark** plan. Register a Web app; Firebase Hosting, Analytics, Gemini, Functions, and Storage are not needed.
2. Enable Google under **Authentication → Sign-in method**, select the project support email, and authorize `localhost`, `127.0.0.1`, and `synneks.github.io` under **Authentication → Settings → Authorized domains**.
3. Create the Standard edition `(default)` Firestore database in production mode. Staging uses **europe-west1 (Belgium)**.
4. Publish this repository's complete `firestore.rules` to staging. Never use open test-mode rules.
5. Fill `.env.staging.local` using `.env.staging.example` and the Web app's public Firebase configuration.
6. Run `npm run dev:staging`, sign in with Google, select **Use initial records** once if the account needs setup, and then import `.runtime/fixtures/realistic.csv` through the existing CSV preview and confirmation. Each tester owns their own notebook; import `empty.csv` when testing first-use behavior.

Both localhost staging and hosted staging use the same cloud test database. Staging deployment preserves its records. Use the existing CSV import to restore a tester's synthetic notebook deliberately; there is no automatic cloud reset or live-data copying.

Firebase Web configuration is public and appears in frontend bundles. Do not put service-account files, private keys, or deploy keys in `VITE_*` variables or the repository.

Publish rules with an explicit project ID:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project my-garage-staging
# Only when releasing a deliberate, tested production rules change:
npx firebase deploy --only firestore:rules --project my-garage-981e8
```

The site deployment workflows do not publish Firestore rules. For a feature that changes the rules, test and publish to staging first; publish compatible production rules before merging frontend code that depends on them. Database schema changes need a separately reviewed compatibility/migration plan.

Official documentation: [separate Firebase projects](https://firebase.google.com/docs/projects/dev-workflows/general-best-practices), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [emulator persistence](https://firebase.google.com/docs/emulator-suite/install_and_configure).

## Storage and synchronization

### Language preferences

Use the **flag + EN / RO** dropdown in the sidebar, above the storage divider, to change the interface instantly. It remains available in the compact navigation on mobile. On first visit, the app uses the first supported browser language, falling back to English. Dates and numbers follow `en-GB` or `ro-RO`; distances remain in kilometres. Both catalogs are bundled, with no translation service or network request needed to switch.

Anonymous choices are stored separately in `localStorage` under `bandit-language-v1`. After sign-in, the account preference takes precedence and synchronizes between devices at `users/{uid}/preferences/interface`, with `language` and a server `updatedAt` timestamp. A missing account preference is initialized without overwriting a preference created by another device. Account caches use `bandit-language-v1:{uid}`. Signing out restores the anonymous choice.

Language changes apply immediately while account saves run asynchronously. Pending and failed synchronization are shown separately from notebook saves, with a retry option. Offline preference writes wait for connectivity. Saved notes, existing seed records, CSV data, notebook revisions, and open form values are preserved. Built-in task guidance is translated separately from editable personal notes. External manuals, Google screens, and native browser controls use their own languages.

**Publish the updated `firestore.rules` before deploying this frontend** so account preferences can synchronize. Older notebook data requires no migration.

Translations live in `src/i18n/locales/en.json` and `ro.json`, with typed keys and English fallback. Add both translations for new interface messages and use plural forms rather than concatenating counts. Catalog tests check key and placeholder coverage. App/domain errors carry stable codes and are translated at rendering time.

Without authentication, the log stays in `localStorage`. Production preserves the existing key `bandit-maintenance-v1`; local and staging keys include the environment and project ID. Changes from other tabs in the same browser update the due dates. Clearing browser data or changing the site's URL requires restoring from CSV.

Each account has a document at `users/{uid}/notebooks/bandit`, containing the log, a revision, and a save timestamp. The rules allow access only to the owner. Account data is not copied into the local log; signing out returns to the previous local copy.

Cloud saves use a transaction. If another device changed the log while the form was open, the save is rejected with an explanatory message. Close the form, review the updated history, and repeat the change. Undoing the last change is available until another revision occurs.

Cloud saves require a connection. An error is not shown as a successful save, and the form stays open. There is no offline queue or automatic server backup. For the MVP, the log occupies a single document, limited to 5,000 maintenance records and 800 KB of JSON. The model can later be extended with individual documents for maintenance records.

## CSV backups

The UTF-8 export with a BOM includes `vehicle`, `event`, and `rule` rows: odometer readings, history, notes, confirmations, and custom milestones. Text that could be interpreted as a formula is protected during export and restored during import. `none` represents a disabled interval or a deleted milestone.

The CSV is intended for a complete reimport, not an arbitrary spreadsheet. An invalid file does not change the log. A valid import requires confirmation after a preview. `examples/bandit-initial.csv` contains the initial records for reference.

Export a copy regularly. Local data on localhost does not automatically appear on GitHub Pages: use the transfer to your Firebase account or CSV export/import.

## Tests and emulators

```sh
npm test
npm run test:ui
npm run test:rules
npm run build:check
```

Unit tests cover maintenance behavior, CSVs, revisions, environment isolation, and synthetic fixtures. Rule tests run in a disposable **demo-bandit-rules** Firestore emulator on **8081**, websocket **9151**, hub **4401**, and logs **4501**. They can run alongside the persistent developer stack, do not import its snapshot, and cannot clear its data.

The UI suite checks language switching, formatting, preserved forms, errors, and preference synchronization races.

CI runs these three commands without production configuration. The compile-check build uses a fake staging Web key and labels `dist/deployment.json` as `verification-only`. Actual staging and production releases use their own configuration and rerun unit tests, rule tests, and the appropriate build before publishing.

## GitHub Pages and feature releases

The production site is **https://synneks.github.io/my-garage/**. Hosted staging uses **https://synneks.github.io/my-garage-staging/**, backed by a separate public repository containing compiled files only. GitHub Pages supports free hosting from public repositories and one site per repository.

### One-time hosting setup

1. Keep production Pages in `Synneks/my-garage` configured to use **GitHub Actions**.
2. Keep the existing production repository variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`.
3. Add staging repository variables in `Synneks/my-garage`: `STAGING_FIREBASE_API_KEY`, `STAGING_FIREBASE_AUTH_DOMAIN`, `STAGING_FIREBASE_PROJECT_ID`, and `STAGING_FIREBASE_APP_ID`, using `.env.staging.local` values.
4. Create public repository **Synneks/my-garage-staging**, initialized with a README. Create its `gh-pages` branch and select **Deploy from a branch → gh-pages → /(root)** under Pages settings. The staging workflow replaces that branch's contents with compiled files on its first release.
5. Generate a dedicated SSH deploy key, register its public half in **my-garage-staging → Settings → Deploy keys** with write access, and store the private half as **STAGING_DEPLOY_KEY** in the **staging** Actions environment of the source repository. The key must target only the staging repository. Keep it out of `VITE_*` values and Git history.
6. Restrict both **github-pages** and **staging** deployment environments in the source repository to `main`. Protect `main` with PRs and the required **CI / verify** status check; no required manual production reviewer is needed for automatic deployment.

The staging workflow must first be merged into `main` before GitHub makes its manual deployment button available. Validate this initial infrastructure change locally before merging.

### Daily workflow

1. Create a feature branch (normally `codex/<feature>`) and develop locally against synthetic emulator data.
2. Run `npm test`, `npm run test:rules`, and `npm run build:check`; push the feature branch and open its PR.
3. In the source repository, run **Deploy feature to staging** with **Use workflow from: main** and enter the feature branch in the **branch** input. The workflow resolves the branch to an exact commit, checks it, builds with staging configuration, and publishes only its static artifact to the staging repository.
4. Test the staging site, including Google sign-in and changes from another device. Load synthetic CSVs as needed. `deployment.json` records the environment, Firebase project, and source commit.
5. Merge the tested commit into `main` after CI passes. **Deploy to GitHub Pages** automatically tests, builds with production variables, and publishes production. Manual reruns are accepted only from `main`. A failed check publishes nothing.

Staging and production share the `synneks.github.io` browser origin. Their signed-out logs use separate storage keys; production preserves `bandit-maintenance-v1`. Firebase sessions belong to their respective projects. Only code and intentional rule changes are promoted; test records stay in test environments.

To roll back production, revert the problematic merge through a PR and merge the revert into `main`. The automatic workflow deploys that revision; Firebase data is not reverted by a frontend rollback.

Assets use relative paths and `.nojekyll` is included. There is no server-side route rewriting. Vite embeds configuration at build time, so configuration changes require rebuilding.

Documentation: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Maintenance records and sources

Primary source: **Suzuki GSF650/S K5 service manual, section 2-2**, consulted on October 5, 2026:

- [Suzuki manual PDF](https://en.enduro.team/images/b/b9/Suzuki-Gsf650s-2005.pdf)
- [Reproduction of the manual's table](https://manuzoid.com/manuals/wrBpO-Suzuki%20GSF650S%20User%20manual)

The supplied records form the basis of the history. Missing time limits were filled in: oil filter and air filter replacement at 36 months; spark plugs and fuel filter at 24 months; 6,000 km inspections also at 12 months. Inspections at 30,137 km are associated with the service on September 10, 2026, subject to owner confirmation where the records do not repeat the date.

The assumed valve clearance check at approximately 24,000 km is not treated as a confirmed maintenance record. The 36,000 km milestones for unknown history remain plans. The tire date of December 1, 2026 is an editable milestone for winter 2026–2027, not a Suzuki recommendation. Later plans do not postpone the calculated due date; a modified custom interval replaces the app's interval and is highlighted in the details.

After a newly confirmed maintenance record becomes the latest reference point, the task's plan is closed and its priority returns to normal. Adding an inspection does not reset the part's replacement interval. For the initial service, replacement of the filters, spark plugs, and brake fluid is also used as an inspection reference point.
