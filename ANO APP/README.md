# ANO Crop Advisory

ANO Crop Advisory is a responsive React app for farmers, agronomists, crop marketing boards, farm teams, and national platform admins in Zimbabwe and Eswatini.

This version is now online-first:

- Firebase-backed auth, Firestore records, and Storage when environment keys are configured
- Local demo mode when Firebase is not yet connected
- Offline caching, queued sync, and a service worker for weak-connectivity areas
- Native mobile shells for Android and iPhone through Capacitor

## What it does

- Creates farmer accounts using name, country, region, and planting date
- Shows only the crops available in the selected region
- Checks whether the farmer already exists in the relevant board registry
- Lets farmers link a board profile if they are not auto-matched
- Captures total hectares, then estimates seed bags or planting material and priced input budgets
- Lets farmers log daily planting progress until the planned area is fully planted
- Lets farmers create staff or worker invite codes so farm teams can log in on their own accounts
- Gives staff members their own linked farm workspace for visibility and planting-progress capture
- Recommends crop varieties based on region and country
- Shows fertiliser, protection, and irrigation schedules from the planting date
- Advises what to plant next season and estimates total cost per hectare before planting starts
- Provides a camera-ready crop enquiry flow with symptom-guided diagnosis and Zimbabwe product suggestions
- Turns hectare-based budgets into supplier-linked marketplace order packs and payment records
- Adds a profitability dashboard with break-even yield, cost, revenue, and margin scenarios
- Tracks harvest output, grade, moisture, losses, and yield per hectare
- Exports farmer performance data as shareable CSV and JSON reports
- Shows official-style market price references, board selling workflow, and delivery planning guidance
- Lets farmers create board delivery bookings with target dates, delivery points, and payment-status tracking
- Lets boards move deliveries from `booked` to `paid` with payment references and due dates
- Adds a separate agronomist role with region, location, specialties, availability, and WhatsApp contact details
- Matches farmers to available agronomists based on region, crop, and issue type
- Gives agronomists a case-management queue with diagnosis notes, product recommendations, and status updates
- Adds a national admin command center for integrations, supplier catalogue review, and mobile release readiness
- Adds a "Today on your farm" action strip, crop-specific visual themes, field-map scouting cards, and accessibility preferences
- Supports optional voice guidance for operational summaries on compatible devices
- Supports browser reminder prompts for urgent weather, planting, and board actions while the app is open
- Includes agronomy escalation, finance, insurance, payment, and support-link sections
- Pulls weather from Open-Meteo and warns when rain should delay fertiliser work
- Lets marketing boards, agronomists, staff, and admins log in and review their own regional or operational views
- Queues writes locally when offline and syncs them once connectivity returns

## Demo board credentials

- `gmb.manager / harvest2026`
- `timb.officer / leaf2026`
- `cane.admin / cane2026`

## Demo agronomist credentials

- `agri.moyo / soil2026`
- `leaf.ncube / leafcare2026`
- `cane.dlamini / caneguard2026`

## Demo admin credentials

- `national.admin / anosuite2026`

## Demo farmer matches

- `Tendai Moyo / GMB-1048 / 2468`
- `Blessing Dube / TIMB-4431 / 1188`
- `Farai Chikowore / SUG-7024 / 3377`
- `Sipho Dlamini / SUG-9012 / 5521`

## Run locally

```bash
npm install
npm run dev
```

If the Firebase env keys are not set, the app starts in local demo mode.

Optional:

```bash
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_DIAGNOSIS_API_URL=https://your-service.example.com/diagnose-crop
VITE_BOARD_SYNC_API_URL=https://your-service.example.com/board-sync
VITE_BOARD_SYNC_API_KEY=your-board-sync-key
VITE_PAYMENTS_API_URL=https://your-service.example.com/payment-intent
VITE_ECOCASH_MERCHANT_CODE=your-ecocash-merchant
VITE_PUSH_GATEWAY_URL=https://your-service.example.com/push-register
VITE_WEB_PUSH_PUBLIC_KEY=your-web-push-public-key
VITE_AGRONOMIST_CASE_API_URL=https://your-service.example.com/agronomist-case
```

If the diagnosis URL is missing, the app still works and falls back to symptom-guided recommendations using the local crop guide.
If the other rollout URLs are missing, the app still works in local and offline-first mode, then falls back to in-app payments, board workflow, reminders, and agronomist case management.

## Build

```bash
npm run build
```

## Mobile apps

This project now includes native mobile projects in [android](C:/Users/trial/Desktop/Codex%20Applications/ANO%20APP/android) and [ios/App](C:/Users/trial/Desktop/Codex%20Applications/ANO%20APP/ios/App).

Useful commands:

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

What is already wired for mobile:

- Native Android and iPhone project scaffolds via Capacitor
- Native camera capture for crop diagnosis photos
- Native local notifications for reminders
- Mobile-safe asset paths and status bar styling

Platform notes:

- Android builds require Java plus Android Studio or the Android SDK on the machine.
- iPhone builds require macOS with Xcode, even though the iOS project scaffold is already generated in this repo.
- On this Windows machine, the native projects were generated and synced successfully, but Android APK compilation could not be completed because `JAVA_HOME` and `java` were not available.

## Firebase setup

1. Create a Firebase project.
2. Copy `.env.example` to `.env` and add:

```bash
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

3. Enable `Email/Password` in Firebase Authentication.
4. Enable `Cloud Firestore` and `Firebase Storage`.
5. Deploy the Firebase rules and indexes from this repo:

```bash
npm run firebase:deploy -- --project your-project-id
```

6. Create board and admin user accounts in Firebase Auth, then create matching documents in the `user_profiles` collection with `role` set to `board` or `admin`. Board users should also get the correct `board_id`.
7. Agronomists can sign up from the app, or you can provision them directly by creating `user_profiles` documents with `role = agronomist` plus `location_detail`, `whatsapp_number`, `specialization_ids`, and `availability_status`.
8. If you want AI image diagnosis, deploy a diagnosis endpoint and set `VITE_DIAGNOSIS_API_URL`.
9. If you want live provider sync, set the optional rollout URLs for board sync, payments, push, and agronomist case dispatch.

## Firebase security files

- `firestore.rules` protects farmer, staff, board, agronomist, and admin access by role and record ownership.
- `storage.rules` protects crop enquiry images in `crop-enquiries/<farmerId>/...`.
- `firestore.indexes.json` includes the composite indexes used by the live app queries.
- `firebase.json` wires those files into Firebase CLI deploys.

## Firebase local testing

Run the Firebase emulators for Auth, Firestore, and Storage with:

```bash
npm run firebase:emulators
```

## Live auth behavior

- Farmers sign up from the app with email and password.
- Agronomists also sign up from the app with email, password, region, location, WhatsApp number, and specialties.
- Farm staff sign up from the app with a farmer-generated invite code.
- Board users sign in with Auth accounts provisioned by an admin.
- Admin users sign in with Auth accounts provisioned by the platform owner in Firebase.
- Email verification is optional in Firebase Auth. The current app flow does not require it before first sign-in.

## Farm team flow

- A farmer opens the `Farm team` section and creates an invite code for a `manager`, `worker`, or `scout`.
- The staff member signs up from the main auth page using that invite code.
- In live mode, the app verifies the invite code in Firestore, creates the Firebase Auth user, links the new staff profile to the farmer, and marks the invite as claimed.
- Staff users then get their own dashboard with the assigned farm's crop plans, reminders, and planting-progress capture.

## Offline behavior

- The app caches the last farmer or board workspace locally.
- Crop plans, board link attempts, profile updates, and enquiries are queued when offline.
- Daily planting progress records are also queued when offline.
- Board delivery bookings are also queued when offline.
- Board-side delivery status updates currently expect a live connection.
- When the device reconnects, the app attempts to sync the queue automatically and also exposes a manual sync button.

## Operations and rollout status

- The new admin command center, agronomist case queue, supplier catalogue, marketplace orders, payment records, harvest tracking, report export, and mobile release checklist are all live in the app today.
- The app shell now lazy-loads the heavier role dashboards so the first load is lighter on slower devices and lower-bandwidth connections.
- In demo mode and offline-first mode, those operational modules currently persist in local app storage so the product can still function without waiting on every external integration.
- The admin and board dashboards now read environment-driven provider readiness, so they can show whether AI diagnosis, board sync, payments, push delivery, and agronomist dispatch are truly configured or still in fallback mode.
- For production national rollout, the next backend hardening step is moving the remaining local-only operational modules into dedicated Firestore collections, cloud functions, and provider webhooks.
- AI diagnosis, push notifications, live board transaction sync, EcoCash or bank payments, and other external-provider flows are integration-ready in the product, but still need real provider credentials and server endpoints before live production use.

## Notes

- The crop, board, and agronomy data in this app is starter data for product design and workflow testing.
- Input prices are curated from Zimbabwe-facing online sellers and official stores, checked on March 10, 2026. They should be refreshed before production purchasing decisions.
- Board price references and support links are starter integrations based on official public pages checked on March 10, 2026. They should be refreshed or connected to live APIs before production rollout.
- The language toggle currently localizes the main shell and action summaries first; the deeper agronomy copy is still starter English content.
- Before a real rollout, the agronomy dataset should be validated with agronomists, marketing boards, and official buyer integrations.
- The offline queue currently stores lightweight mutation payloads in browser storage. For very high photo volume, the next upgrade should move queued binary storage to IndexedDB.
