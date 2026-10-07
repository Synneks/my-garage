# Bandit · Maintenance Log

An English and Romanian app for the 2005 Suzuki GSF650S Bandit (K5), built with **React, TypeScript, Vite, Tailwind, and shadcn/ui**. Firebase Authentication (Google) and Cloud Firestore provide authentication and synchronization. The frontend can be deployed to GitHub Pages; no Node server or Docker is required in production.

Initial odometer reading: **30,920 km**. Data from the previous version is automatically preserved at the same URL in the same browser.

## Getting started

Use Node.js **22.12+** (or 20.19+). Normal development needs no Java, Firebase CLI login, or local database.

1. Copy `.env.staging.example` to `.env.staging.local` and fill in the public Web configuration from **My Garage Staging** (`my-garage-staging`). Skip this step if the file is already configured.
2. Install dependencies and start the app:

```sh
npm ci
npm run dev
```

Open http://localhost:4174 and sign in with Google. The frontend runs on your computer; authentication and saves use the **cloud test project**, with its separate Firestore database. Internet access is required for cloud sign-in and saves.

The staging banner identifies the project. Each account has its own notebook. For a new account, select **Use initial records** once, then import the synthetic CSV through **Fișă și date** and confirm its preview:

```sh
npm run mock:csv
```

This generates `.runtime/fixtures/realistic.csv` and `empty.csv`. Reimport either file deliberately to reset your test notebook. Normal starts and builds preserve cloud data.

## Two environment profiles

| Purpose              | Command                                         | Firebase project    |
| -------------------- | ----------------------------------------------- | ------------------- |
| Local development    | `npm run dev`                                   | `my-garage-staging` |
| Test build / preview | `npm run build:staging`, then `npm run preview` | `my-garage-staging` |
| Production build     | `npm run build`                                 | `my-garage-981e8`   |

Local development and staging builds share the same cloud test project and database. Production is deployed to GitHub Pages after a merge to `main`. A separate hosted staging site or repository is not required.

Keep staging settings in `.env.staging.local` and production settings in `.env.production.local` (template: `.env.example`). Both are ignored by Git. If production settings currently live in `.env.local`, rename it to `.env.production.local` and add `VITE_APP_ENV=production`.

Configuration checks prevent development servers from selecting production, reject the wrong project ID, and reject generic Firebase settings in `.env` or `.env.local`. Shell overrides are also validated. Restart Vite after configuration changes.

`npm run preview` serves a staging build on http://localhost:4177 and refuses production artifacts. No emulator startup, snapshot, or reset commands are part of app development.

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

Production uses the existing **my-garage-981e8** project. Development uses **My Garage Staging**, **my-garage-staging**, on the Spark plan. Staging has its own Google Authentication users and Standard Firestore `(default)` database in **europe-west1 (Belgium)**.

Staging is already configured with Google sign-in, authorized domains `localhost` and `127.0.0.1`, and this repository's owner-only `firestore.rules`. New developers need the staging Web configuration in their ignored environment file. Firebase Web configuration is public; never use service-account credentials or private keys in `VITE_*` variables.

The site deployment does not publish database rules. If a feature changes rules, test and publish to staging first. Publish compatible production rules deliberately before releasing dependent frontend code:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project my-garage-staging
# Only for an intentional production rules release:
npx firebase deploy --only firestore:rules --project my-garage-981e8
```

Only code is promoted after testing. Synthetic records remain in staging; production data is never copied or reset by these commands.

## Storage and synchronization

### Language preferences

Use the **flag + EN / RO** dropdown in the sidebar, above the storage divider, to change the interface instantly. It remains available in the compact navigation on mobile. On first visit, the app uses the first supported browser language, falling back to English. Dates and numbers follow `en-GB` or `ro-RO`; distances remain in kilometres. Both catalogs are bundled, with no translation service or network request needed to switch.

Anonymous choices are stored separately in `localStorage` under `bandit-language-v1`. After sign-in, the account preference takes precedence and synchronizes between devices at `users/{uid}/preferences/interface`, with `language` and a server `updatedAt` timestamp. A missing account preference is initialized without overwriting a preference created by another device. Account caches use `bandit-language-v1:{uid}`. Signing out restores the anonymous choice.

Language changes apply immediately while account saves run asynchronously. Pending and failed synchronization are shown separately from notebook saves, with a retry option. Offline preference writes wait for connectivity. Saved notes, existing seed records, CSV data, notebook revisions, and open form values are preserved. Built-in task guidance is translated separately from editable personal notes. External manuals, Google screens, and native browser controls use their own languages.

**Publish the updated `firestore.rules` before deploying this frontend** so account preferences can synchronize. Older notebook data requires no migration.

Translations live in `src/i18n/locales/en.json` and `ro.json`, with typed keys and English fallback. Add both translations for new interface messages and use plural forms rather than concatenating counts. Catalog tests check key and placeholder coverage. App/domain errors carry stable codes and are translated at rendering time.

Without authentication, the log stays in `localStorage`. Production preserves the existing key `bandit-maintenance-v1`; the staging key includes the environment and project ID. Changes from other tabs in the same browser update the due dates. Clearing browser data or changing the site's URL requires restoring from CSV.

Each account has a document at `users/{uid}/notebooks/bandit`, containing the log, a revision, and a save timestamp. The rules allow access only to the owner. Account data is not copied into the local log; signing out returns to the previous local copy.

Cloud saves use a transaction. If another device changed the log while the form was open, the save is rejected with an explanatory message. Close the form, review the updated history, and repeat the change. Undoing the last change is available until another revision occurs.

Cloud saves require a connection. An error is not shown as a successful save, and the form stays open. There is no offline queue or automatic server backup. For the MVP, the log occupies a single document, limited to 5,000 maintenance records and 800 KB of JSON. The model can later be extended with individual documents for maintenance records.

## CSV backups

The UTF-8 export with a BOM includes `vehicle`, `event`, and `rule` rows: odometer readings, history, notes, confirmations, and custom milestones. Text that could be interpreted as a formula is protected during export and restored during import. `none` represents a disabled interval or a deleted milestone.

The CSV is intended for a complete reimport, not an arbitrary spreadsheet. An invalid file does not change the log. A valid import requires confirmation after a preview. `examples/bandit-initial.csv` contains the initial records for reference.

Export a copy regularly. Local data on localhost does not automatically appear on GitHub Pages: use the transfer to your Firebase account or CSV export/import.

## Tests

```sh
npm test
npm run test:ui
npm run test:rules
npm run build:staging
```

Unit tests cover maintenance behavior, CSVs, revisions, environment selection, browser-storage isolation, and synthetic fixtures.

The UI suite checks language switching, formatting, preserved forms, errors, and preference synchronization races.

**Only security-rule tests require Java 21+**. They use a disposable Firestore emulator (`demo-bandit-rules`) on port **8081**, with websocket **9151**, hub **4401**, and logs **4501**. They do not use cloud staging or production. The test launcher can use Java on PATH or an existing JRE under `.runtime/jdk-21*/bin`. The first run may download emulator binaries.

CI runs unit tests, UI tests, rule tests, and a staging compilation using fake public Web settings. It has no production Firebase configuration and publishes no artifact.

## GitHub Pages and releases

The production site is **https://synneks.github.io/my-garage/**.

1. Develop on a feature branch/worktree with `npm run dev` and cloud test data.
2. Run the checks above, test the app locally, and open a PR.
3. Merge into `main` after CI passes.
4. **Deploy to GitHub Pages** automatically checks, builds with production configuration, and deploys. A failed check publishes nothing; manual production runs are accepted only from `main`.

Keep Pages configured to use **GitHub Actions** in `Synneks/my-garage`. The existing repository variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` supply production Web settings. Local testing needs no GitHub staging repository, deploy key, or staging repository variables.

To roll back frontend code, merge a revert PR into `main`. The normal production workflow deploys the reverted code; database records are unaffected.

Assets use relative paths and `.nojekyll` is included. Vite embeds Firebase settings at build time, so changes require a rebuild. Separate browser-storage keys keep signed-out staging and production notebooks apart.

## Supporting scripts

Daily startup invokes Vite directly. Four small scripts remain:

- `load-environment.mjs` reads and validates the selected configuration.
- `mock-data.mjs` generates optional synthetic CSVs.
- `run-rules.mjs` runs disposable security-rule tests.
- `postbuild.mjs` adds GitHub Pages files and the environment marker used to keep previews on staging.

## Maintenance records and sources

Primary source: **Suzuki GSF650/S K5 service manual, section 2-2**, consulted on October 5, 2026:

- [Suzuki manual PDF](https://en.enduro.team/images/b/b9/Suzuki-Gsf650s-2005.pdf)
- [Reproduction of the manual's table](https://manuzoid.com/manuals/wrBpO-Suzuki%20GSF650S%20User%20manual)

The supplied records form the basis of the history. Missing time limits were filled in: oil filter and air filter replacement at 36 months; spark plugs and fuel filter at 24 months; 6,000 km inspections also at 12 months. Inspections at 30,137 km are associated with the service on September 10, 2026, subject to owner confirmation where the records do not repeat the date.

The assumed valve clearance check at approximately 24,000 km is not treated as a confirmed maintenance record. The 36,000 km milestones for unknown history remain plans. The tire date of December 1, 2026 is an editable milestone for winter 2026–2027, not a Suzuki recommendation. Later plans do not postpone the calculated due date; a modified custom interval replaces the app's interval and is highlighted in the details.

After a newly confirmed maintenance record becomes the latest reference point, the task's plan is closed and its priority returns to normal. Adding an inspection does not reset the part's replacement interval. For the initial service, replacement of the filters, spark plugs, and brake fluid is also used as an inspection reference point.
