# Tohobil API

The mobile app calls `/api/v1`. The admin panel calls `/admin-api/v1`. Both are served by the CodeIgniter 4 app in `/api`. Money amounts are integers in minor units. Admin responses never include ledger amounts, notes, or file contents.

## Mobile authentication

Send `Authorization: Bearer <token>` on every route except health, app status, content, registration, and login. Text-message code routes stay public and return `SMS_NOT_CONFIGURED`. The AccessGuard rejects disabled, blocked, and maintenance states.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create an account. Body: `name`, `phone`, `password`, `accept_terms`, and optional `country`, `currency`, `language`. No text-message code. A token is returned when the account is created. |
| POST | `/api/v1/auth/login` | Sign in and receive a bearer token |
| POST | `/api/v1/auth/logout` | Revoke the current token |
| POST | `/api/v1/auth/otp/send` | Text-message codes are off. Returns `SMS_NOT_CONFIGURED` and stores nothing. |
| POST | `/api/v1/auth/otp/verify` | Text-message codes are off. Returns `SMS_NOT_CONFIGURED`. |
| POST | `/api/v1/auth/password/reset` | Text-message reset is off. Returns `SMS_NOT_CONFIGURED` and does not change the password. |
| POST | `/api/v1/auth/password/change` | Change the signed-in password |
| POST | `/api/v1/me/phone/change` | Text-message phone change is off. Returns `SMS_NOT_CONFIGURED` and does not change the phone. |
| GET | `/api/v1/me` | Profile |
| PUT | `/api/v1/me` | Update profile fields |
| POST | `/api/v1/me/avatar` | Upload a profile photo |
| GET | `/api/v1/me/avatar` | Download the profile photo |
| GET | `/api/v1/me/sessions` | List sessions |
| DELETE | `/api/v1/me/sessions` | Revoke every session |
| DELETE | `/api/v1/me/sessions/{id}` | Revoke one session |
| GET | `/api/v1/me/export` | Download account data |
| GET | `/api/v1/me/export-zip` | Download a zip export |
| DELETE | `/api/v1/me` | Schedule deletion. Requires the account password. A text-message code is refused. The account is disabled immediately and purged after 30 days by `cron:daily`. |

## Devices, sync, files, and notifications

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/devices/register` | Register this installation |
| PUT | `/api/v1/devices/push-token` | Store the FCM token |
| DELETE | `/api/v1/devices/push-token` | Remove the FCM token |
| GET | `/api/v1/notifications` | In-app inbox |
| POST | `/api/v1/notifications/read` | Mark inbox rows read |
| DELETE | `/api/v1/notifications/{id}` | Remove one inbox row |
| POST | `/api/v1/push/opened` | Record that a push was opened |
| POST | `/api/v1/sync/push` | Upload local changes |
| GET | `/api/v1/sync/pull` | Download changes since a revision |
| GET | `/api/v1/rates` | Exchange-rate snapshot. Query `base` is a 3-letter currency. |
| POST | `/api/v1/files` | Upload a private file. Quota is the user's override or the default. |
| GET | `/api/v1/files/{id}` | Download a file owned by the caller |
| GET | `/api/v1/files/{id}/thumb` | Download its thumbnail |
| DELETE | `/api/v1/files/{id}` | Delete a file owned by the caller |
| GET | `/api/v1/storage/usage` | Used bytes, quota, and file count |
| GET | `/api/v1/app/status` | Maintenance, versions, flags, and account state |
| GET | `/api/v1/content/faq` | Published help |
| GET | `/api/v1/support/tickets` | The caller's tickets |
| POST | `/api/v1/support/tickets/{id}/reply` | Reply on a ticket |
| POST | `/api/v1/feedback` | Create a support ticket |

Shared books use `/api/v1/books/{id}/invite`, `/members`, and `/api/v1/books/invitations`.

## Admin authentication

The session cookie is `tohobil_admin_session` (HttpOnly, SameSite=Strict). Authenticated writes send `X-Admin-CSRF`. Login, two-factor, forgot, and reset also require a same-origin browser request.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/admin-api/v1/auth/login` | Email and password. May return `2fa_required`. |
| POST | `/admin-api/v1/auth/2fa/verify` | Complete TOTP. Body: `challenge`, `code`. |
| POST | `/admin-api/v1/auth/forgot` | Body: `email`. Always returns the same success message. |
| POST | `/admin-api/v1/auth/reset` | Body: `token`, `password` (at least 12 characters). |
| POST | `/admin-api/v1/auth/logout` | End this session |
| POST | `/admin-api/v1/auth/logout-others` | End the caller's other admin sessions |
| GET | `/admin-api/v1/auth/me` | Current admin and a fresh CSRF token |

Every other admin route is behind the permission filter. A missing permission returns 403.

## Admin users, devices, and audit

`GET /admin-api/v1/users` supports `search`, `status`, `platform`, `language`, `country`, `app_version`, `signed_from`, `signed_to`, `active_within_days`, `inactive_for_days`, `has_push`, `page`, and `per_page`.

`GET /admin-api/v1/users/{id}` returns profile, devices, session count, transaction and debt counts, file count, storage bytes, last sync time, notes, status history, and push titles. It does not return amounts or ledger notes.

| Method | Path | Permission |
| --- | --- | --- |
| PUT | `/admin-api/v1/users/{id}` | `users.edit` |
| POST | `/admin-api/v1/users/{id}/verify-phone` | `users.edit` |
| POST | `/admin-api/v1/users/{id}/notes` | `users.edit` |
| POST | `/admin-api/v1/users/{id}/quota` | `users.edit`. Body `quota_mb`. |
| POST | `/admin-api/v1/users/{id}/disable` | `users.disable` |
| POST | `/admin-api/v1/users/{id}/enable` | `users.edit` |
| POST | `/admin-api/v1/users/{id}/block` | `users.block` |
| POST | `/admin-api/v1/users/{id}/unblock` | `users.block` |
| POST | `/admin-api/v1/users/{id}/revoke-sessions` | `users.edit` |
| DELETE | `/admin-api/v1/users/{id}` | `users.delete`. Body `current_password`. Schedules purge after 30 days. |

`GET /admin-api/v1/devices` supports `search`, `status`, and pagination. `GET /admin-api/v1/devices/suspicious` returns shared device IDs, IPs with repeated failures, and the sign-up count for the last hour. Block and unblock are `POST /admin-api/v1/devices/{id}/block` and `/unblock`.

`GET /admin-api/v1/audit?export=csv` requires `export.data`.

## Admin push, SMS, security, and settings

`GET /admin-api/v1/push` lists campaigns, templates, and automations. `POST /admin-api/v1/push` creates one. Body fields: `category` (`announcement`, `offer`, `update`, `security`), English and optional Bengali title and body, `target` (`user`, `selected`, `segment`, `all`), `when` (`draft`, `now`, `schedule`), `scheduled_at`, and target filters. Sending to everyone requires `push.send_all` and `current_password` unless the campaign stays a draft.

`POST /admin-api/v1/push/estimate` returns device and user counts. `POST /admin-api/v1/push/image` accepts multipart field `image` and stores a public 1024×512 JPEG under 300 KB. Templates and automations are `POST /admin-api/v1/push/templates` and `/push/automations`. Cancel and duplicate are `POST /admin-api/v1/push/{id}/cancel` and `/duplicate`.

`GET /admin-api/v1/sms` and `POST /admin-api/v1/sms/test` manage the log-only SMS driver. Test messages store a masked body.

`GET /admin-api/v1/security` lists recent failed admin and user sign-ins, blocked-event counts, and active admin sessions. `DELETE /admin-api/v1/security/sessions/{id}` revokes another admin session.

`GET` and `POST /admin-api/v1/settings` read and write support contacts, SMTP, SMS driver, timezone, quotas, and retention. The SMTP password is never returned. `POST /admin-api/v1/settings/firebase` accepts multipart field `service_account` and writes it to `writable/firebase/service-account.json` with mode 0600. The response includes the project id and client email only.

`GET /admin-api/v1/system/health` adds queue length, a Firebase credential boolean, and sanitized recent error lines. `POST /admin-api/v1/system/retry` requeues failed push jobs.

## Cron

These commands refuse to run from the web:

- `php spark cron:minute` every minute for push jobs and scheduled campaigns.
- `php spark cron:automations` every 15 minutes.
- `php spark cron:daily` for stats, expired OTP and blocklist cleanup, orphan files, accounts past the 30-day deletion grace, and an exchange-rate snapshot stored as decimal strings.
