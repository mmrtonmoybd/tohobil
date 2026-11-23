# Firebase setup

Push uses Firebase Cloud Messaging HTTP v1. The Android client config and the server credential are different files.

## Android client

1. In the Firebase console, open the Tohobil project (or create one) and add an Android app with the application id in `src/app/config.ts` (`com.tohobil.app` until you change it).
2. Download `google-services.json` and put it at `android/app/google-services.json`. This file identifies the Android client. It is not a server key.
3. Add the debug and release SHA-1 and SHA-256 fingerprints under Project settings, Your apps.

## Server credential

1. In Project settings, open Service accounts and generate a private key.
2. Save that JSON only at `api/writable/firebase/service-account.json`.
3. Keep it out of git. Mode `0600`, owned by the PHP user, is enough on a single server.
4. From `api/`, send a test with `php spark push:test` after a signed-in device has opted in.

To rotate the key, generate a second key, replace the file, confirm a test delivery, then delete the old key in Google Cloud IAM. Do not put the JSON in `android/`, `src/`, `admin/`, or any public upload directory.
