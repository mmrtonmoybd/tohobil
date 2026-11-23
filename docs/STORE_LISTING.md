# Tohobil — Store Listing & Google Play Console Guide

## 1. App Metadata

- **Application ID Placeholder**: `com.tohobil.app`
  > **IMPORTANT**: Change `com.tohobil.app` to your verified developer package name (e.g. `com.yourcompany.tohobil`) in `android/app/build.gradle` and `capacitor.config.ts` **before** the very first release build upload to Google Play / Apple App Store. It can never be changed after publication!
- **App Name**: Tohobil: Personal Finance
- **App Name (Bengali)**: তহবিল: ব্যক্তিগত আয় ব্যয় ও দেনা-পাওনা
- **Short Description (up to 80 chars - EN)**:
  Simple, offline-first personal finance, expense tracker, and Dena-Paona manager.
- **Short Description (up to 80 chars - BN)**:
  সহজ ও নিরাপদ ব্যক্তিগত আয়-ব্যয়, বাজেট এবং দেনা-পাওনার হিসাব।

---

## 2. Full Description (Google Play / App Store)

```markdown
Tohobil (তহবিল) is a modern, privacy-first personal financial manager tailored specifically for everyday Bangladeshi life. 

Whether you are budgeting your family monthly expenses, tracking bKash/Nagad and bank accounts, managing loans with relatives and friends (দেনা-পাওনা), or planning savings goals, Tohobil gives you total clarity over your money.

★ 100% OFFLINE-FIRST & LIGHTNING FAST
Your data is stored right on your phone in an encrypted database. It opens instantly, works without internet, and syncs seamlessly across your devices when you are online.

★ QUICK ADD WITH CALCULATOR KEYPAD
Log expenses in under 3 seconds. The custom built-in calculator keypad lets you do basic math (e.g., 50+20) without switching to the phone's system keyboard.

★ MFS & BANK SMS PASTE PARSER
Tohobil respects your privacy: we NEVER ask for the intrusive READ_SMS permission. Simply copy any bKash, Nagad, Rocket, or Bank notification and tap "Paste SMS" — Tohobil will auto-detect the amount, type, fee, and TrxID.

★ COMPLETE DENA-PAONA (LOANS & RECEIVABLES)
- Track who owes you (পাওনা) and whom you owe (দেনা).
- Installment schedules with automated due date alerts.
- Send courteous, pre-written payment reminder messages via WhatsApp or SMS.
- Generate and share branded PDF statements for any person.

★ MULTI-CURRENCY & WEALTH
- Track Cash in hand, Bank accounts, Mobile Wallets (bKash/Nagad), and Credit Cards.
- Track Assets & Investments: FDR, DPS, Sanchayapatra, Gold, Land, and Stocks.
- Daily Net Worth chart over time.

★ SMART TOOLS
- Zakat Calculator: Auto-calculates 2.5% Zakat using live Tohobil balance or custom Gold/Silver Nisab.
- Loan EMI & Amortization Calculator.
- FDR / DPS Maturity & statutory tax withholding calculator.
- Two-way Currency Converter.

★ BANK-GRADE PRIVACY & SECURITY
- App Lock with 4-digit PIN and Fingerprint / Biometric authentication.
- Privacy Screen: Prevents screenshots and hides app contents in the recent-apps switcher.
- Local Encrypted Backup: Export and restore AES-256 encrypted .tohobil backups with your private passphrase.
- "Download My Data": Export all your records, CSV spreadsheets, and receipts into a ZIP file whenever you want.
- Complete Account Deletion: Delete your account and wipe all server records directly in-app or via our web portal.
```

---

## 3. Google Play Data Safety Form Answers

| Category | Data Type | Collected? | Shared? | Purpose | Encrypted in Transit? | User Can Delete? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal Info** | Phone number | Yes | No | Account management, authentication | Yes (HTTPS) | Yes |
| **Personal Info** | Name (optional) | Yes | No | Personalization, profile display | Yes (HTTPS) | Yes |
| **Personal Info** | Email (optional) | Yes | No | Account recovery, statements | Yes (HTTPS) | Yes |
| **Financial Info** | Transaction history | Yes | No | App functionality (personal accounting) | Yes (HTTPS) | Yes |
| **Financial Info** | Account balances & wealth | Yes | No | App functionality (net worth, balances) | Yes (HTTPS) | Yes |
| **Photos & Videos**| Receipts & Vault files | Yes | No | User-selected proof attachments | Yes (HTTPS) | Yes |
| **Device Info** | Device ID & OS version | Yes | No | Sync sessions and push notifications | Yes (HTTPS) | Yes |

- **Data Encryption**: All data is encrypted in transit over secure HTTPS / TLS connections.
- **Account Deletion Web Link**: `https://tohobil.app/delete-account` (Complies with Google Play policy).
- **Privacy Policy Web Link**: `https://tohobil.app/privacy-policy`

---

## 4. Android App Bundle (AAB) Release Instructions

1. **Change Application ID** in `android/app/build.gradle`:
   ```groovy
   applicationId "com.yourcompany.tohobil"
   ```
2. **Generate Release Keystore** (Keep secure, never commit to git):
   ```bash
   keytool -genkey -v -keystore tohobil-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias tohobil
   ```
3. **Build Production Web Bundle**:
   ```bash
   npm run build
   npx cap sync android
   ```
4. **Build Signed Android App Bundle (AAB)**:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   The generated `.aab` file will be located at:
   `android/app/build/outputs/bundle/release/app-release.aab`
