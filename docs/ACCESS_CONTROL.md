# Tohobil Access Control & Device Policy

This document details the account suspension, device identification, firewall blocklisting, and client enforcement policies implemented across Tohobil.

---

## 1. User Account Lifecycle

Each user in the Tohobil database maintains a strict `status`:

| Status | Meaning | Recovery / Behavior |
| :--- | :--- | :--- |
| **`active`** | Normal operational account | Standard access to all features and sync endpoints. |
| **`disabled`** | Reversible temporary suspension | Access is paused until an administrator re-enables it or an optional expiry date (`status_until`) is reached. Data remains preserved on the server. |
| **`blocked`** | Permanent ban | Full account termination. The user's phone number is automatically added to the permanent blocklist so they cannot register again. All active authentication tokens are revoked immediately. |

---

## 2. Device Identification & Fingerprinting

Modern operating systems (Android 10+ and iOS) restrict applications from accessing hardware MAC addresses. Tohobil identifies client installations through a dual-identifier strategy:

1. **`device_uid`**: Retrieved directly via `@capacitor/device` `getId()`. Represents the hardware installation identifier.
2. **`installation_id`**: A cryptographically random UUID generated on the client's first boot and stored in secure hardware-backed storage (`@aparajita/capacitor-secure-storage`).
3. **Hardware Telemetry**: Manufacturer, device model, operating system version, app release version, client locale, and network IP.

Devices are registered and refreshed during:
- Initial registration / authentication (`POST /api/v1/devices/register`)
- App launch & resume from background
- Push notification token generation or renewal (`PUT /api/v1/devices/push-token`)

---

## 3. Global Blocklist

The `blocklist` table functions as an application-level firewall supporting four distinct types:
- **`phone`**: Prevents registration, login, and OTP dispatch for specific phone numbers.
- **`device`**: Blocks specific `device_uid` strings regardless of the account trying to authenticate.
- **`ip`**: Blocks single IPv4 or IPv6 client addresses.
- **`cidr`**: Blocks whole IP subnets (e.g., `192.168.1.0/24` or offending VPN/datacenter IP blocks).

Entries support optional expiry dates (`expires_at`), which are purged automatically during the daily maintenance cron (`cron:daily`).

---

## 4. Server Guard: `AccessGuard` Filter

Every inbound request to `/api/v1/*` passes through `App\Filters\AccessGuard`. The filter verifies:
1. **Maintenance Mode**: Returns `503 MAINTENANCE` (exempts `/health` and `/app/status`).
2. **Version Gate**: Returns `426 UPDATE_REQUIRED` if the client app version is below `min_android_version`.
3. **IP / CIDR Blocklist**: Returns `403 ACCESS_BLOCKED`.
4. **Device Blocklist**: Returns `403 DEVICE_BLOCKED`.
5. **Phone Blocklist & User Status**:
   - Disabled: Returns `403 ACCOUNT_DISABLED`
   - Blocked: Returns `403 ACCOUNT_BLOCKED`

---

## 5. Mobile App Handling

When the mobile app encounters any access guard code:
- **UI Presentation**: Displays a full-screen native state (`AccessScreen`) displaying the specific issue icon, title, administrative reason, and a direct "Contact Support" action button.
- **`UPDATE_REQUIRED`**: Displays an "Update" button linking directly to the Google Play Store.
- **Token Invalidation**: For `ACCOUNT_DISABLED`, `ACCOUNT_BLOCKED`, `DEVICE_BLOCKED`, and `ACCESS_BLOCKED`, the mobile app halts background sync and clears session tokens.
- **Encrypted Local Storage**: The local SQLite database remains preserved on the device. If the administrative suspension is lifted, the user can re-authenticate and immediately resume without loss of records.

---

## 6. Known Architectural Limits & Edge Cases

> [!IMPORTANT]
> **Offline Usage**: A user whose device remains offline will continue to have access to their local encrypted database until the app next establishes an internet connection and contacts the server (`GET /api/v1/app/status`). Real-time blocks take effect immediately upon the next network ping.
>
> **Factory Reset**: A full factory reset of an Android phone wipes the secure storage and regenerates a new device ID. In such scenarios, the user's permanent phone block and IP/CIDR blocklist entries continue to prevent unauthorized access and registration.
