# Bandit · Maintenance Log

A Romanian-language app for the 2005 Suzuki GSF650S Bandit (K5), built with **React, TypeScript, Vite, Tailwind, and shadcn/ui**. Firebase Authentication (Google) and Cloud Firestore provide authentication and synchronization. The frontend can be deployed to GitHub Pages; no Node server or Docker is required in production.

Initial odometer reading: **30,920 km**. Data from the previous version is automatically preserved at the same URL in the same browser.

## Getting started

Node.js **22.12+** (or 20.19+):

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Without Firebase configuration, the app works locally, with browser storage and CSV backups.

```sh
npm test
npm run build
```

`npm run preview` serves the build from `dist` on port 4173; stop the development server first. Do not open the HTML through `file://`.

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
6. Copy `.env.example` to `.env.local` and fill in the values from the Web app's `firebaseConfig` configuration:

```dotenv
VITE_FIREBASE_API_KEY=your_apiKey_value
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=your_appId_value
VITE_USE_FIREBASE_EMULATORS=false
```

These values are public Web configuration. Do not include private keys or service accounts. `.env.local` is ignored by Git. Keep the `authDomain` provided by Firebase; add the GitHub Pages domain under Authorized domains.

7. Publish the complete **firestore.rules** file under **Firestore → Rules → Publish**, or use the CLI:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project FIREBASE_PROJECT_ID
```

8. Restart `npm run dev` and use **Google sign-in**. On your first sign-in, choose **Transfer local log** to keep existing maintenance records, or **Use initial records**. An existing log in the account is loaded automatically and is not replaced by the local copy.

Official documentation: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firestore](https://firebase.google.com/docs/firestore/quickstart), [authorized domains for new projects](https://firebase.google.com/docs/auth/web/email-link-auth), [plans and quotas](https://firebase.google.com/pricing).

## Storage and synchronization

Without authentication, the log stays in `localStorage` under the existing key `bandit-maintenance-v1`. Changes from other tabs in the same browser update the due dates. Clearing browser data or changing the site's URL requires restoring from CSV.

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
npm run test:rules
```

The first command checks due dates, CSV handling, validation, and revisions. The second temporarily starts the Firestore emulator and checks rules, account isolation, and concurrent transactions. It requires **Java 21+** in `PATH`; the Firebase CLI downloads the emulator on the first run. The `demo-bandit` project is local and does not access a real project.

To test authentication and the cloud interface manually:

1. Copy `.env.emulator.example` to `.env.emulator`.
2. In one terminal, run `npm run emulators`.
3. In another terminal, run `npm run dev:emulator` and open http://localhost:4174.
4. The **Sign in with a test account** button uses a fictitious Google account exclusively in the emulator, without external windows. Emulator data is temporary and disappears when it stops.

The production build does not use emulators. Do not deploy a build with the demo configuration. CI runs the tests, Firestore tests, and build.

## GitHub Pages

Deploy the **contents of `dist`** generated by the build. Vite uses relative assets, including under the repository path. App navigation does not require server-side URL rewrites. `.nojekyll` is included in the build.

The `.github/workflows/deploy-pages.yml` workflow is ready for manual deployment:

1. Add the project to a GitHub repository and push it.
2. Under **Settings → Pages**, select **GitHub Actions** as the source.
3. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` with the values for the real project.
4. Publish the Firestore rules and add `USERNAME.github.io` to Firebase Authorized domains.
5. Under **Actions → Deploy to GitHub Pages → Run workflow**, start the deployment. The workflow tests, builds, and deploys `dist`. Missing or demo configuration stops deployment with a clear message.

Vite variables are included at build time; redeploy after changing the Firebase configuration. The workflow does not create the Firebase project or publish the rules.

Documentation: [Vite on Pages](https://vite.dev/guide/static-deploy#github-pages), [Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Maintenance records and sources

Primary source: **Suzuki GSF650/S K5 service manual, section 2-2**, consulted on October 5, 2026:

- [Suzuki manual PDF](https://en.enduro.team/images/b/b9/Suzuki-Gsf650s-2005.pdf)
- [Reproduction of the manual's table](https://manuzoid.com/manuals/wrBpO-Suzuki%20GSF650S%20User%20manual)

The supplied records form the basis of the history. Missing time limits were filled in: oil filter and air filter replacement at 36 months; spark plugs and fuel filter at 24 months; 6,000 km inspections also at 12 months. Inspections at 30,137 km are associated with the service on September 10, 2026, subject to owner confirmation where the records do not repeat the date.

The assumed valve clearance check at approximately 24,000 km is not treated as a confirmed maintenance record. The 36,000 km milestones for unknown history remain plans. The tire date of December 1, 2026 is an editable milestone for winter 2026–2027, not a Suzuki recommendation. Later plans do not postpone the calculated due date; a modified custom interval replaces the app's interval and is highlighted in the details.

After a newly confirmed maintenance record becomes the latest reference point, the task's plan is closed and its priority returns to normal. Adding an inspection does not reset the part's replacement interval. For the initial service, replacement of the filters, spark plugs, and brake fluid is also used as an inspection reference point.
