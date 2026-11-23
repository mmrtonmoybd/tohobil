# Tohobil Server Operations & Deployment Guide

This document describes deployment, database setup, background cron scheduling, and administrative operations for the Tohobil backend and operations portal.

---

## 1. Architecture Overview

- **Mobile API**: CodeIgniter 4 application located in `/api`.
  - Document root: `api/public/`
  - API base URL: `https://api.tohobil.app/api/v1/`
  - Admin API: `https://api.tohobil.app/admin-api/v1/`
- **Admin Operations Portal**: React + TypeScript application located in `/admin`.
  - Built output: `api/public/admin/`
  - Accessible directly at `https://api.tohobil.app/admin` (served via `Web\AdminWeb`).
  - Session auth: SameSite cookie (`tohobil_admin_session`) and cryptographic Bearer tokens.
  - Strict privacy rule: Admins can view device health, system metrics, file counts, and storage sizes only. User ledgers, transaction figures, and financial notes are never exposed.

---

## 2. Server Requirements

- PHP 8.2+ with required extensions:
  - `intl`, `mbstring`, `mysqli`, `fileinfo`, `gd`, `curl`, `zip`
- MySQL 8.0+ or MariaDB 10.5+ (InnoDB, `utf8mb4_unicode_ci`)
- Composer 2.x
- Node.js 18+ and npm (for building the admin portal and mobile assets)
- HTTPS with valid SSL certificate (mandatory for production)

---

## 3. Environment Configuration (`api/.env`)

Copy `api/env` or create `api/.env`:

```ini
CI_ENVIRONMENT = production
app.baseURL = 'https://api.tohobil.app/'
app.appTimezone = 'Asia/Dhaka'

# Database Credentials
database.default.hostname = localhost
database.default.database = tohobil_prod
database.default.username = tohobil_user
database.default.password = 'StrongSecretPasswordHere'
database.default.DBDriver = MySQLi
database.default.DBPrefix = ''

# Text-message codes are off until an SMS gateway is connected.
# Registration does not ask for a code. Password reset by text is closed.
```

Ensure permissions on `api/writable/` are writable by the web server (`chmod -R 775 api/writable`).

---

## 4. Initial Setup & Migrations

1. **Install backend dependencies**:
   ```bash
   cd api
   composer install --no-dev --optimize-autoloader
   ```

2. **Execute Database Migrations**:
   ```bash
   cd api
   php spark migrate
   ```
   This provisions all tables including `users`, `devices`, `sync_*`, `files`, `admins`, `admin_roles`, `admin_sessions`, `announcements`, `daily_stats`, `cron_runs`, `support_tickets`, `faq_articles`, and `app_config`.

3. **Provision First Super Administrator**:
   ```bash
   cd api
   php spark admin:create --name="Lead Admin" --email="admin@tohobil.app" --password="StrongPassword123" --role="super_admin"
   ```

4. **Build Admin Operations Panel**:
   ```bash
   cd ../admin
   npm install
   npm run build
   ```
   Assets compile directly into `api/public/admin/`.

---

## 5. cPanel & Web Server Configuration

### Document Root
Point the primary domain or subdomain document root directly to:
```
/home/user/tohobil/api/public
```
Keep `api/app`, `api/writable`, `api/vendor`, and `admin/` outside the public web root.

### Apache `.htaccess` (bundled in `api/public/.htaccess`)
Ensures URL rewriting routes all API requests through `index.php` and protects sensitive directories.

---

## 6. Scheduled Cron Jobs (cPanel Crontab)

Configure the following three cron jobs in your cPanel Crontab (`crontab -e`):

| Frequency | Command | Purpose |
| :--- | :--- | :--- |
| **Every minute** (`* * * * *`) | `cd /path/to/tohobil/api && php spark cron:minute >/dev/null 2>&1` | Processes queued tasks and scheduled push batches. |
| **Every 15 minutes** (`*/15 * * * *`) | `cd /path/to/tohobil/api && php spark cron:automations >/dev/null 2>&1` | Evaluates engagement automations and user retention checks. |
| **Daily at midnight** (`0 0 * * *`) | `cd /path/to/tohobil/api && php spark cron:daily >/dev/null 2>&1` | Aggregates `daily_stats` (DAU/WAU/MAU, storage), purges expired OTPs and expired blocklist entries, and cleans up orphaned files. |

> [!NOTE]
> All cron commands record their start time, completion status, and runtime duration in the `cron_runs` table, visible live in the Admin Panel at `/admin/system`.

---

## 7. Administrative Portal Features (`/admin`)

- **Dashboard**: High-level KPI cards (Total Users, DAU, WAU, MAU, Devices, Storage Used), 14-day user sign-up trajectory charts, and system alerts.
- **Users**: Search directory by name, phone, or ID. Detail view displays registered devices, sessions, file counts, and storage consumed. Action tools to Suspend Account, Ban User & Phone, or Revoke All Device Sessions.
- **Devices & Blocklist**: Real-time client device telemetry (model, OS, app version) with instant blocking. Global firewall blocklist for phones, device UIDs, single IPs, and CIDR subnets.
- **In-App Announcements**: Broadcast news cards with optional image, action link, and audience targeting. Includes a live mobile app phone mockup preview.
- **Customer Support Desk**: Inquiries and bug reports submitted via the app's Help & Feedback become tickets. Admins can post official responses directly into the user's mobile notification inbox.
- **FAQ Knowledgebase**: Author, organize, and publish bilingual help articles (English & বাংলা) served dynamically to the mobile app via `GET /api/v1/content/faq`.
- **Remote App Config & Flags**:
  - Global Maintenance Mode killswitch with custom user message.
  - Minimum supported Android version (`min_android_version`) for mandatory updates.
  - Latest version prompt (`latest_android_version`) for soft update notifications.
  - Feature flags JSON dictionary returned live to clients.
- **Files & Storage**: MIME type breakdown, top storage consumers, and on-demand orphan file cleanup scanner.
- **System Diagnostics**: Server PHP, CI4, and MySQL versions, database disk size, storage free space, and cron execution logs.
- **Audit Trail**: Searchable, immutable record of all administrative logins, account bans, and configuration changes.
- **Administrators**: Role-based access control (`super_admin`, `admin`, `support`, `marketing`, `viewer`) and staff account provisioning.
