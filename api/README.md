# Tohobil API

CodeIgniter 4 app for the mobile client and the admin site.

- Mobile routes are under `/api/v1`.
- Admin routes are under `/admin-api/v1`.
- The web server document root is `public/`.

Request and response details are in [docs/API.md](../docs/API.md). Server setup is in [docs/DEPLOY.md](../docs/DEPLOY.md).

```sh
cp env .env
composer install
php spark migrate
php spark serve --host 127.0.0.1 --port 8000
```

Set the database credentials in `.env`. Do not commit that file. Place the Firebase service account, when you use push, at `writable/firebase/service-account.json`.
