# My garage · Maintenance Log

An English and Romanian app for managing your vehicles, maintenance tasks, and service history, built with **React, TypeScript, Vite, Tailwind, and shadcn/ui**. Firebase Authentication (Google) and Cloud Firestore provide authentication and synchronization. The frontend can be deployed to GitHub Pages; no Node server or Docker is required in production.

Signed-out visitors see a landing page introducing the watch list, upcoming mileage milestones, and service tracker. The interactive preview uses a separate fictional dataset in `src/lib/demo-data.ts`, bundled with English/Romanian translations and no database reads. It contains no account records. Sign in with Google to manage a garage. Each new vehicle starts with empty maintenance and history. Existing Bandit logs are preserved and migrated to editable vehicle data. The Suzuki **Reference and data** section remains unchanged.

## Getting started

Node.js **22.12+** (or 20.19+). Authored application code, tests, and build scripts use TypeScript; `tsx` runs the Node test suite and postbuild script without generating JavaScript beside source files. Vite generates browser JavaScript only in `dist`.

Copy `.env.example` to `.env.development.local` and fill in the Web app configuration for **my-garage-dev** (project ID `my-garage-dev-6169f`). Create `.env.production.local` with the live project configuration. Both files use the same four `VITE_FIREBASE_*` names; Vite selects the file for the current mode.

```sh
npm ci
npm run dev
```

Open http://localhost:5173 (or the URL printed by Vite if that port is occupied). `npm run dev` uses the **my-garage-dev** cloud development database and Email/Password Authentication, with an orange navigation accent and a test-data banner. Missing or incorrect development settings stop startup with a configuration error instead of falling back to production.

For development sign-in, enable Email/Password in the dev Firebase project and create a shared test account. Set `VITE_DEV_AUTH_EMAIL` and `VITE_DEV_AUTH_PASSWORD` in `.env.development.local`. The development sign-in button uses that account directly. Production continues using Google sign-in. To use copied garage data, its `users/{uid}` path must match the test account UID.

`npm run build` and the existing GitHub Pages workflow continue using the original `VITE_FIREBASE_*` production settings. The live app remains **https://synneks.github.io/my-garage/**; there is no second hosted app or repository.

Environment variables are validated with [T3 Env](https://env.t3.gg/docs/core) and Zod in `src/lib/env.ts`, shared by the app and Vite startup/build. Both modes require all four Firebase settings; development also requires the designated test project. Empty values count as missing, and whitespace-only values are rejected.

To migrate an existing `.env.local`, move its production `VITE_FIREBASE_*` values to `.env.production.local`. Move the test values to `.env.development.local`, renaming `VITE_DEV_FIREBASE_*` to `VITE_FIREBASE_*`, then remove the Firebase entries from `.env.local`. The mode-specific files are ignored by Git.

```sh
npm test
npm run build
```

`npm run preview` serves the production build from `dist` on Vite's default preview port, 4173. Do not open the HTML through `file://`.

## Features

- Dashboard with priorities and upcoming milestones.
- Multiple vehicles per account; add, edit, select, and delete vehicles.
- Create, edit, and delete maintenance tasks with your own names, categories, actions, sources, intervals, milestones, and notes.
- User content stays in the language entered, independently of the English/Romanian interface.
- Deleting a task retains its service records and recorded task names. Those records can still be edited or deleted individually.
- History with dates, odometer readings, notes, and confirmation of completed work; add, edit, delete, and undo the last change.
- Due dates based on mileage **or** time, whichever comes first.
- Custom intervals, planned milestones, and editable priorities.
- Search and filters; mobile-friendly interface.
- Complete CSV backups and validated imports with a preview.
- Google sign-in required for changes, Firestore synchronization, and protection against concurrent changes.

## Firebase setup

Configure a Firebase project to enable Google sign-in and cloud synchronization.

1. Create a project in the [Firebase Console](https://console.firebase.google.com/). The MVP uses Authentication and Firestore, without Functions or Storage. You can start with the Spark plan and its free quotas.
2. Under **Project settings → Your apps**, register a Web app. You do not need to enable Firebase Hosting for GitHub Pages.
3. Under **Authentication → Sign-in method**, enable **Google** and choose the support email required by the console.
4. Under **Authentication → Settings → Authorized domains**, add `localhost`, `127.0.0.1`, and, once you have chosen a repository, `USERNAME.github.io`. Enter only the domain, without the protocol or repository path. New projects may require adding localhost manually.
5. Create a **Cloud Firestore, Standard edition, `(default)`** database in a suitable region. Start in production mode, then publish the app's rules.
6. Create `.env.development.local` for the test project (copy `.env.example`) and `.env.production.local` for the live project. Each file contains the same four variable names with its own Web app configuration:

```dotenv
VITE_FIREBASE_API_KEY=your_apiKey_value
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=your_appId_value
```

These values are public Web configuration. Do not include private keys or service accounts. Both `.env.development.local` and `.env.production.local` are ignored by Git. Keep the `authDomain` provided by Firebase; add the GitHub Pages domain under Authorized domains.

The test project needs Google sign-in, authorized domains `localhost` and `127.0.0.1`, a Firestore database, and the same `firestore.rules`. Local development saves only to this test project. Production GitHub repository variables stay as they are.

7. Publish the complete **firestore.rules** file under **Firestore → Rules → Publish**, or use the CLI:

```sh
npx --package firebase-tools firebase login
npx --package firebase-tools firebase deploy --only firestore:rules --project FIREBASE_PROJECT_ID
```

8. Restart `npm run dev` and use **Google sign-in**. Choose **Add vehicle**, then create your maintenance tasks. If an existing local log is found and the account has no vehicles yet, **Transfer local log** preserves it as a vehicle. Existing account vehicles load automatically and are not replaced by the local copy.

Official documentation: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firestore](https://firebase.google.com/docs/firestore/quickstart), [authorized domains for new projects](https://firebase.google.com/docs/auth/web/email-link-auth), [plans and quotas](https://firebase.google.com/pricing).

## Storage and synchronization

### Language preferences

Use the **flag + EN / RO** dropdown in the landing-page header or the signed-in sidebar to change the interface instantly. It remains available on mobile. On first visit, the app uses the first supported browser language, falling back to English. Dates and numbers follow `en-GB` or `ro-RO`; distances remain in kilometres. Both catalogs are bundled, with no translation service or network request needed to switch.

Anonymous choices are stored separately in `localStorage` under `bandit-language-v1`. After sign-in, the account preference takes precedence and synchronizes between devices at `users/{uid}/preferences/interface`, with `language` and a server `updatedAt` timestamp. A missing account preference is initialized without overwriting a preference created by another device. Account caches use `bandit-language-v1:{uid}`. Signing out restores the anonymous choice.

Language changes apply immediately while account saves run asynchronously. Pending and failed synchronization are shown separately from notebook saves, with a retry option. Offline preference writes wait for connectivity. Only the read-only demo translates its task names, categories, actions, sources, notes and example history, using the `preview.*` catalogs. Account and legacy local data always display their saved text verbatim, even when task IDs match the demo. For example, saved Romanian or Polish maintenance tasks remain in their original language in an English interface. Language switching never writes translated demo content into an account, backup, or open editor. External manuals, Google screens, and native browser controls use their own languages.

**Publish the updated `firestore.rules` before using this frontend.** The garage needs owner-only collection reads at `users/{uid}/notebooks` and preference access at `users/{uid}/preferences/interface`. Rules from the original app permit only the single `bandit` document, so deploying only the frontend produces permission errors after sign-in. The new rules support version 2 vehicle notebooks and retain version 1 writes to the original `bandit` document during rollout. Existing version 1 logs remain readable; the app migrates them in memory and persists version 2 on the next save. Once a notebook is migrated, older clients cannot downgrade it; use the new frontend for that notebook.

Translations live in `src/i18n/locales/en.json` and `ro.json`, with typed keys and English fallback. Add both translations for new interface messages and use plural forms rather than concatenating counts. Catalog tests check key and placeholder coverage. App/domain errors carry stable codes and are translated at rendering time.

Without authentication, visitors see only the landing page and its fictional feature examples, even if a legacy local log exists. Local records are retained for the transfer option after sign-in. Visitors cannot change vehicles, tasks, or service history. The demo is never written to the database or `localStorage`, and is never copied into users' accounts. The existing key `bandit-maintenance-v1` is retained only for recovering legacy production logs; development uses its separate project-specific key. Local records are left untouched during migration and transfer.

Each vehicle has a document at `users/{uid}/notebooks/{vehicleId}`, containing its vehicle details, complete task definitions, service history, personal plans, revision, and server save timestamp. New vehicle IDs are UUIDs; an existing `bandit` document keeps its original ID. Collection subscriptions synchronize vehicle additions, updates, and deletions. The rules allow access only to the account owner. Account data is not copied into the local log; signing out clears account data from the screen.

Task and record IDs are stable. Every service record stores its task name and action as recorded, so renaming or deleting a task does not rewrite history. A service record may also be entered without a maintenance task. For these records, **Save task with action for future** is unchecked by default: check it to save the name/action as a reusable maintenance task together with the service record. No recurring interval is added automatically; intervals can be set later in Maintenance. Vehicle deletion removes that vehicle's tasks and history after an explicit confirmation; it is not undoable.

Cloud saves use a transaction. If another device changed the log while the form was open, the save is rejected with an explanatory message. Close the form, review the updated history, and repeat the change. Undoing the last change is available until another revision occurs.

Cloud saves require a connection. An error is not shown as a successful save, and the form stays open. There is no offline queue or automatic server backup. Each vehicle occupies one document, limited to 1,000 tasks, 5,000 service records, and 800 KB of JSON. The model can later be extended with individual documents for maintenance records.

## CSV backups

The UTF-8 export with a BOM includes `vehicle`, `task`, `event`, and `rule` rows: vehicle make/model/year/mileage, task definitions, historical task names, history, notes, confirmations, and custom milestones. Text that could be interpreted as a formula is protected during export and restored during import. `none` represents a disabled interval or a deleted milestone. Legacy Bandit CSV backups are accepted and migrated. Export/import applies to the selected vehicle, leaving other vehicles intact.

The CSV is intended for a complete reimport, not an arbitrary spreadsheet. An invalid file does not change the log. A valid import requires confirmation after a preview. `examples/bandit-initial.csv` contains the initial records for reference.

Export a copy regularly. Local data on localhost does not automatically appear on GitHub Pages: use the transfer to your Firebase account or CSV export/import.

## Tests

```sh
npm test
npm run test:ui
```

Firestore rule tests use a local emulator (Java 21+); they never write to the development or production database:

```sh
npx --package firebase-tools firebase emulators:exec --only firestore --project demo-garage-crud "npm run test:rules"
```

The unit tests check migration, arbitrary vehicle/task validation, retained history, vehicle isolation, due dates, CSV handling, revisions, translations, and environment selection. The UI suite checks vehicle/task/history CRUD, sign-in requirements, language switching without changing user content, preserved forms, rejected saves, and preference synchronization races. The emulator suite checks owner/anonymous/other-account access, vehicle CRUD, revisions, migration, and retained history. CI runs the unit/UI suites and a production build using the same four GitHub repository variables as deployment. Manual sign-in and save checks use the `my-garage-dev` cloud project. `firestore.rules` remains the security policy for both cloud projects.

## GitHub Pages

Deploy the **contents of `dist`** generated by the build. Vite uses relative assets, including under the repository path. App navigation does not require server-side URL rewrites. `.nojekyll` is included in the build.

The `.github/workflows/deploy-pages.yml` workflow is ready for manual deployment:

1. Add the project to a GitHub repository and push it.
2. Under **Settings → Pages**, select **GitHub Actions** as the source.
3. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` with the values for the real project.
4. Publish the Firestore rules and add `USERNAME.github.io` to Firebase Authorized domains.
5. Under **Actions → Deploy to GitHub Pages → Run workflow**, start the deployment. The workflow tests, builds, and deploys `dist`. Missing configuration stops deployment with a clear message.

Vite variables are included at build time; redeploy after changing the Firebase configuration. The workflow does not create the Firebase project or publish the rules.

Documentation: [Vite on Pages](https://vite.dev/guide/static-deploy#github-pages), [Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Theme and color palette

`src/index.css` defines the shared light and dark palette for the landing page
and signed-in garage: warm off-white, navy, and burnt orange in light mode;
deep blue-green surfaces and peach accents in dark mode. Landing-page aliases
reference these same tokens. Use semantic utilities such as
`bg-card`, `text-muted-foreground`, `text-link`, and `border-input` in components;
use the same variables in custom CSS. Define new color roles in both themes here
instead of adding hex values or theme-specific fallbacks to individual layouts.

Status badges and notifications share `danger`, `warning`, `success`, and `info`
surface/foreground pairs. Keep status labels visible alongside color. Navigation
uses the `sidebar-*` tokens, also used by the landing page's dark call-to-action
panel. Development adds an orange navigation border as its environment indicator.
Flag artwork keeps its original colors.

`npm test` checks the palette's normal-text pairs at 4.5:1 and control boundaries
and focus indicators at 3:1, including both themes and development navigation.
Decorative dividers use `border`; interactive boundaries use the stronger `input`
token. Filled buttons have explicit foreground and hover tokens.

## Maintenance records and sources

Primary source: **Suzuki GSF650/S K5 service manual, section 2-2**, consulted on October 5, 2026:

- [Suzuki manual PDF](https://en.enduro.team/images/b/b9/Suzuki-Gsf650s-2005.pdf)
- [Reproduction of the manual's table](https://manuzoid.com/manuals/wrBpO-Suzuki%20GSF650S%20User%20manual)

The supplied records form the basis of the history. Missing time limits were filled in: oil filter and air filter replacement at 36 months; spark plugs and fuel filter at 24 months; 6,000 km inspections also at 12 months. Inspections at 30,137 km are associated with the service on September 10, 2026, subject to owner confirmation where the records do not repeat the date.

The assumed valve clearance check at approximately 24,000 km is not treated as a confirmed maintenance record. The 36,000 km milestones for unknown history remain plans. The tire date of December 1, 2026 is an editable milestone for winter 2026–2027, not a Suzuki recommendation. Later plans do not postpone the calculated due date; a modified custom interval replaces the app's interval and is highlighted in the details.

After a newly confirmed maintenance record becomes the latest reference point, the task's plan is closed and its priority returns to normal. Adding an inspection does not reset the part's replacement interval. For the initial service, replacement of the filters, spark plugs, and brake fluid is also used as an inspection reference point.
