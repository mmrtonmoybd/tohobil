<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= esc($title ?? 'Delete Account · Tohobil') ?></title>
    <style>
        :root {
            --primary: #0d9488;
            --primary-dark: #0f766e;
            --danger: #dc2626;
            --danger-bg: #fef2f2;
            --danger-border: #fecaca;
            --surface: #ffffff;
            --bg: #f8fafc;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --radius: 16px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .card {
            background: var(--surface);
            max-width: 500px;
            width: 100%;
            border-radius: var(--radius);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
            border: 1px solid var(--border);
            padding: 32px 24px;
        }
        .header {
            text-align: center;
            margin-bottom: 24px;
        }
        .logo-wrap {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #0d9488, #4f46e5);
            border-radius: 14px;
            margin-bottom: 12px;
            box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);
        }
        .logo-wrap svg {
            width: 30px;
            height: 30px;
            fill: #ffffff;
        }
        h1 {
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 6px;
        }
        .subtitle {
            font-size: 14px;
            color: var(--muted);
            line-height: 1.5;
        }
        .alert {
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 13.5px;
            line-height: 1.4;
            margin-bottom: 20px;
        }
        .alert-error {
            background: var(--danger-bg);
            border: 1px solid var(--danger-border);
            color: var(--danger);
        }
        .alert-info {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
        }
        .alert-success {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #15803d;
        }
        .warning-box {
            background: #fffbeb;
            border: 1px solid #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 14px;
            border-radius: 8px;
            font-size: 13px;
            color: #92400e;
            margin-bottom: 22px;
            line-height: 1.45;
        }
        .form-group {
            margin-bottom: 18px;
        }
        label {
            display: block;
            font-size: 13.5px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 6px;
        }
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 12px 14px;
            font-size: 15px;
            border: 1px solid var(--border);
            border-radius: 10px;
            outline: none;
            transition: border-color 0.15s ease;
        }
        input:focus {
            border-color: var(--primary);
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 13px;
            font-size: 15px;
            font-weight: 600;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            transition: opacity 0.15s ease;
            text-decoration: none;
        }
        .btn-danger {
            background: var(--danger);
            color: #ffffff;
        }
        .btn-danger:hover { opacity: 0.92; }
        .btn-secondary {
            background: #e2e8f0;
            color: var(--text);
            margin-top: 8px;
        }
        .tab-selector {
            display: flex;
            background: #f1f5f9;
            padding: 4px;
            border-radius: 10px;
            margin-bottom: 16px;
        }
        .tab-btn {
            flex: 1;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 600;
            border: none;
            background: transparent;
            border-radius: 7px;
            cursor: pointer;
            color: var(--muted);
        }
        .tab-btn.active {
            background: #ffffff;
            color: var(--text);
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .footer-note {
            text-align: center;
            margin-top: 24px;
            font-size: 12px;
            color: var(--muted);
            line-height: 1.5;
        }
    </style>
</head>
<body>
<div class="card">
    <div class="header">
        <div class="logo-wrap">
            <svg viewBox="0 0 24 24">
                <path d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8zm4-2.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
            </svg>
        </div>
        <h1>Delete Tohobil Account</h1>
        <p class="subtitle">আপনার তহবিল অ্যাকাউন্ট ও ডেটা মুছে ফেলুন</p>
    </div>

    <?php if ($success): ?>
        <div class="alert alert-success">
            <strong>Account Deleted / অ্যাকাউন্ট মোছা হয়েছে:</strong><br>
            <?= esc($success) ?>
        </div>
        <p style="text-align:center; font-size:14px; color:var(--muted); margin-top:16px;">
            Thank you for having used Tohobil. You may now close this window.<br>
            তহবিল ব্যবহার করার জন্য ধন্যবাদ। আপনি এখন এই উইন্ডো বন্ধ করতে পারেন।
        </p>
    <?php else: ?>
        <?php if ($error): ?>
            <div class="alert alert-error"><?= esc($error) ?></div>
        <?php endif; ?>
        <?php if (session()->getFlashdata('info')): ?>
            <div class="alert alert-info"><?= esc(session()->getFlashdata('info')) ?></div>
        <?php endif; ?>

        <div class="warning-box">
            <strong>Warning / সতর্কতা:</strong> Deleting your account will permanently wipe all your books, transactions, debts, goals, budgets, assets, and uploaded receipts from Tohobil servers. This action cannot be reversed.
        </div>

        <form method="post" action="/delete-account" id="deleteForm">
            <?= csrf_field() ?>
            <input type="hidden" name="auth_method" id="authMethod" value="password">

            <div class="form-group">
                <label for="phone">Phone Number / ফোন নম্বর</label>
                <input type="text" id="phone" name="phone" value="<?= esc($phone) ?>" placeholder="e.g. 01700000000" required>
            </div>

            <p class="subtitle">Text-message codes are turned off. Enter your password. এসএমএস কোড বন্ধ আছে। পাসওয়ার্ড লিখুন।</p>

            <div class="form-group" id="passwordGroup">
                <label for="password">Account Password / পাসওয়ার্ড</label>
                <input type="password" id="password" name="password" placeholder="Enter your password" required>
            </div>

            <button type="submit" class="btn btn-danger" onclick="return confirm('Are you sure you want to permanently delete your account and all data? This cannot be undone.');">
                Permanently Delete My Account
            </button>
        </form>
    <?php endif; ?>

    <div class="footer-note">
        This account deletion portal complies with Google Play and Apple App Store Developer Policies.<br>
        Tohobil · তহবিল — Privacy-first Personal Financial Manager.
    </div>
</div>
</body>
</html>
