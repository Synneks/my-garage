# Bandit · Maintenance Log

An English and Romanian app for the 2005 Suzuki GSF650S Bandit (K5), built with **React, TypeScript, Vite, Tailwind, and shadcn/ui**. Firebase Authentication (Google) and Cloud Firestore provide authentication and synchronization. The frontend can be deployed to GitHub Pages; no Node server or Docker is required in production.

Initial odometer reading: **30,920 km**. Data from the previous version is automatically preserved at the same URL in the same browser.

## Getting started

Node.js **22.12+** (or 20.19+):

Keep your existing production settings in `.env.local`. Add the four `VITE_DEV_FIREBASE_*` values from `.env.example` using the Web app configuration for **my-garage-dev** (project ID `my-garage-dev-72659`). These settings are separate from the existing `VITE_FIREBASE_*` production values; no file rename is needed.

```sh
npm ci
npm run dev
```

Open http://localhost:5173 (or the URL printed by Vite if that port is occupied). `npm run dev` uses the **my-garage-dev** cloud development database and Google Authentication, with orange navigation and a test-data banner. Missing or incorrect development settings show a configuration error instead of falling back to production.

`npm run build` and the existing GitHub Pages workflow continue using the original `VITE_FIREBASE_*` production settings. The live app remains **https://synneks.github.io/my-garage/**; there is no second hosted app or repository.

```sh
npm test
npm run build
```

`npm run preview` serves the production build from `dist` on Vite's default preview port, 4173. Do not open the HTML through `file://`.

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

Configure a Firebase project to enable Google sign-in and cloud synchronization.

1. Create a project in the [Firebase Console](https://console.firebase.google.com/). The MVP uses Authentication and Firestore, without Functions or Storage. You can start with the Spark plan and its free quotas.
2. Under **Project settings → Your apps**, register a Web app. You do not need to enable Firebase Hosting for GitHub Pages.
3. Under **Authentication → Sign-in method**, enable **Google** and choose the support email required by the console.
4. Under **Authentication → Settings → Authorized domains**, add `localhost`, `127.0.0.1`, and, once you have chosen a repository, `USERNAME.github.io`. Enter only the domain, without the protocol or repository path. New projects may require adding localhost manually.
5. Create a **Cloud Firestore, Standard edition, `(default)`** database in a suitable region. Start in production mode, then publish the app's rules.
6. For production, keep the existing `VITE_FIREBASE_*` values in `.env.local` (or copy `.env.example` for a new checkout). Add the separate `VITE_DEV_FIREBASE_*` values from the `my-garage-dev` Web app for local development:

```dotenv
VITE_FIREBASE_API_KEY=your_apiKey_value
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=your_appId_value
VITE_DEV_FIREBASE_API_KEY=your_test_apiKey_value
VITE_DEV_FIREBASE_AUTH_DOMAIN=my-garage-dev-72659.firebaseapp.com
VITE_DEV_FIREBASE_PROJECT_ID=my-garage-dev-72659
VITE_DEV_FIREBASE_APP_ID=your_test_appId_value
```

These values are public Web configuration. Do not include private keys or service accounts. `.env.local` is ignored by Git. Keep the `authDomain` provided by Firebase; add the GitHub Pages domain under Authorized domains.

The test project needs Google sign-in, authorized domains `localhost` and `127.0.0.1`, a Firestore database, and the same `firestore.rules`. Local development saves only to this test project. Production GitHub repository variables stay as they are.

7. Publish the complete **firestore.rules** file under **Firestore → Rules → Publish**, or use the CLI:

```sh
npx --package firebase-tools firebase login
npx --package firebase-tools firebase deploy --only firestore:rules --project FIREBASE_PROJECT_ID
```

8. Restart `npm run dev` and use **Google sign-in**. On your first sign-in, choose **Transfer local log** to keep existing maintenance records, or **Use initial records**. An existing log in the account is loaded automatically and is not replaced by the local copy.

Official documentation: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firestore](https://firebase.google.com/docs/firestore/quickstart), [authorized domains for new projects](https://firebase.google.com/docs/auth/web/email-link-auth), [plans and quotas](https://firebase.google.com/pricing).

## Storage and synchronization

### Language preferences

Use the **flag + EN / RO** dropdown in the sidebar, above the storage divider, to change the interface instantly. It remains available in the compact navigation on mobile. On first visit, the app uses the first supported browser language, falling back to English. Dates and numbers follow `en-GB` or `ro-RO`; distances remain in kilometres. Both catalogs are bundled, with no translation service or network request needed to switch.

Anonymous choices are stored separately in `localStorage` under `bandit-language-v1`. After sign-in, the account preference takes precedence and synchronizes between devices at `users/{uid}/preferences/interface`, with `language` and a server `updatedAt` timestamp. A missing account preference is initialized without overwriting a preference created by another device. Account caches use `bandit-language-v1:{uid}`. Signing out restores the anonymous choice.

Language changes apply immediately while account saves run asynchronously. Pending and failed synchronization are shown separately from notebook saves, with a retry option. Offline preference writes wait for connectivity. Saved notes, existing seed records, CSV data, notebook revisions, and open form values are preserved. Built-in task guidance is translated separately from editable personal notes. External manuals, Google screens, and native browser controls use their own languages.

**Publish the updated `firestore.rules` before deploying this frontend** so account preferences can synchronize. Older notebook data requires no migration.

Translations live in `src/i18n/locales/en.json` and `ro.json`, with typed keys and English fallback. Add both translations for new interface messages and use plural forms rather than concatenating counts. Catalog tests check key and placeholder coverage. App/domain errors carry stable codes and are translated at rendering time.

Without authentication, the log stays in `localStorage`. Production preserves the existing key `bandit-maintenance-v1`; development uses a separate key including the test project ID. Changes from other tabs in the same browser update the due dates. Clearing browser data or changing the site's URL requires restoring from CSV.

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
```

The unit tests check due dates, CSV handling, validation, revisions, translations, and environment selection. The UI suite checks language switching, formatting, preserved forms, errors, and preference synchronization races. CI runs both suites and a production build. Manual sign-in and save checks use the `my-garage-dev` cloud project. `firestore.rules` remains the security policy for both cloud projects.

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

## Maintenance records and sources

Primary source: **Suzuki GSF650/S K5 service manual, section 2-2**, consulted on October 5, 2026:

- [Suzuki manual PDF](https://en.enduro.team/images/b/b9/Suzuki-Gsf650s-2005.pdf)
- [Reproduction of the manual's table](https://manuzoid.com/manuals/wrBpO-Suzuki%20GSF650S%20User%20manual)

The supplied records form the basis of the history. Missing time limits were filled in: oil filter and air filter replacement at 36 months; spark plugs and fuel filter at 24 months; 6,000 km inspections also at 12 months. Inspections at 30,137 km are associated with the service on September 10, 2026, subject to owner confirmation where the records do not repeat the date.

The assumed valve clearance check at approximately 24,000 km is not treated as a confirmed maintenance record. The 36,000 km milestones for unknown history remain plans. The tire date of December 1, 2026 is an editable milestone for winter 2026–2027, not a Suzuki recommendation. Later plans do not postpone the calculated due date; a modified custom interval replaces the app's interval and is highlighted in the details.

After a newly confirmed maintenance record becomes the latest reference point, the task's plan is closed and its priority returns to normal. Adding an inspection does not reset the part's replacement interval. For the initial service, replacement of the filters, spark plugs, and brake fluid is also used as an inspection reference point.
