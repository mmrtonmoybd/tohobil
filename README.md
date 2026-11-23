# Tohobil

Tohobil (তহবিল) is a personal finance app for everyday money. It keeps cash, mobile wallets, bank accounts, income, expenses, transfers, and dena-paona (money lent and borrowed) in one place. Bangladesh is the home case: taka (৳), Bengali, and local number grouping. Other countries use their own currency and phone code.

The Android app works offline. A PHP API stores the backup, and a separate admin site operates users, devices, and app settings without opening anyone's ledger.

Author: [Moshiur Rahman](https://github.com/mmrtonmoybd)

## Features

- Several books, each with its own accounts and records
- Income, expense, and transfer, stored as integer minor units
- People, debts, installments, and a statement you can share
- Bills, budgets, and savings goals
- Assets, and a document vault for receipts and papers
- Reports, search, and CSV export
- Tools for zakat, loan EMI, FDR/DPS, and currency conversion
- English and Bengali, with every visible string in both language files
- App lock with a PIN and biometrics
- Phone and password sign-in. Text-message codes are off until an SMS gateway is connected. A signed-in person changes their password from Profile. Deleting an account requires that password
- Daily exchange-rate snapshot on the server. The app reads the stored rates. It does not call the rate provider itself

## Project layout

| Path | What it is |
| --- | --- |
| `src/` | Ionic React app |
| `android/` | Capacitor Android project. Application id `com.tohobil.app` |
| `api/` | CodeIgniter 4 API and the public web root |
| `admin/` | Operations site. The production build is written to `api/public/admin/` |
| `docs/` | API, deploy, access control, Firebase, store listing, privacy policy, and terms |
| `database/schema.sql` | Reference schema |

Money is never stored as a floating-point number. Amounts are integers in the currency's minor unit (poisha for BDT, cents for USD).

## Requirements

- Node.js 20+ and npm
- PHP 8.2+ with `intl`, `mbstring`, `mysqli`, `fileinfo`, `gd`, `curl`, and `zip`
- Composer 2
- MariaDB 10.5+ or MySQL 8
- Android Studio, or a JDK and Android SDK, when you build the APK

## Run the app in a browser

```sh
npm install
npm run dev
```

Open the URL Vite prints. The browser keeps its database in local SQLite on top of IndexedDB. That data is separate from a phone install.

Point the app at your API with `VITE_API_URL` in `.env` (see `.env.example`). Use an `https://` origin for a release build. An emulator reaches a local API at `http://10.0.2.2:8000` when you build with:

```sh
npm run build:android-dev
```

## Run the API

```sh
cd api
cp env .env
composer install
php spark migrate
php spark serve --host 127.0.0.1 --port 8000
```

Edit `api/.env` and set the database name, user, and password. That file stays on the machine. Do not commit it.

Create the first administrator:

```sh
php spark admin:create --name="Your Name" --email="you@example.com" --password="a-long-password" --role="super_admin"
```

The admin sign-in uses email, password, and an authenticator app (TOTP) when the account has one enrolled.

Useful commands from `api/`:

| Command | Purpose |
| --- | --- |
| `php spark migrate` | Apply database migrations |
| `php spark cron:minute` | Queued work and scheduled push batches |
| `php spark cron:automations` | Engagement automations |
| `php spark cron:daily` | Daily stats, cleanup, and the exchange-rate snapshot |
| `php spark cron:rates` | Refresh only the stored exchange rates |

Put the exchange-rate provider key in `api/.env` as `exchangeRate.apiKey`, or save it from the admin settings. The cron job fetches USD rates once and stores them. Clients call `GET /api/v1/rates`.

Account deletion is also available on the web at `/delete-account`. It asks for the password.

## Run the admin site

For local development:

```sh
cd admin
npm install
npm run dev
```

For a server, build it into the API public directory:

```sh
cd admin
npm install
npm run build
```

The site is then served at `/admin` on the API host. See [docs/DEPLOY.md](docs/DEPLOY.md) for the document root, cron lines, and production `.env` values.

## Android

```sh
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Open the project in Android Studio with `npx cap open android` if you prefer a device picker.

`com.tohobil.app` is the application id. Change it in `src/app/config.ts` before the first store upload. After that change, register the new id in Firebase and replace `android/app/google-services.json`. The Firebase private key belongs only in `api/writable/firebase/service-account.json` on the server. Git ignores that path. Steps are in [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

## Checks

```sh
npm run build
npm run lint
npm test
npm run format:check
npx cap sync android
```

API tests, from `api/`:

```sh
vendor/bin/phpunit
```

Point PHPUnit at a database you can wipe. `api/phpunit.dist.xml` names that test database. Do not aim it at a database that has real accounts.

## Further reading

- [docs/API.md](docs/API.md) — mobile and admin HTTP API
- [docs/DEPLOY.md](docs/DEPLOY.md) — server setup and cron
- [docs/ACCESS_CONTROL.md](docs/ACCESS_CONTROL.md) — account, device, and block rules
- [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) — push credentials
- [docs/STORE_LISTING.md](docs/STORE_LISTING.md) — store text
- [docs/privacy-policy.html](docs/privacy-policy.html) and [docs/terms.html](docs/terms.html)

## License

The application code in this repository is released by Moshiur Rahman. Third-party notices for Hind Siliguri and Material Symbols are in `resources/`.
