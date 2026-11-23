<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class ServerOperations extends Migration
{
    public function up()
    {
        $statements = [
            "CREATE TABLE IF NOT EXISTS admins (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                email VARCHAR(190) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'admin',
                totp_secret VARCHAR(64) NULL,
                is_2fa_enabled TINYINT(1) NOT NULL DEFAULT 0,
                status VARCHAR(16) NOT NULL DEFAULT 'active',
                failed_logins SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                locked_until DATETIME NULL,
                last_login_at DATETIME NULL,
                last_login_ip VARCHAR(45) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_admins_status (status),
                INDEX idx_admins_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS admin_sessions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                admin_id BIGINT UNSIGNED NOT NULL,
                token_hash CHAR(64) NOT NULL UNIQUE,
                ip VARCHAR(45) NULL,
                user_agent VARCHAR(255) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_sessions_admin (admin_id),
                CONSTRAINT fk_admin_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS admin_roles (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(60) NOT NULL,
                slug VARCHAR(32) NOT NULL UNIQUE,
                permissions TEXT NOT NULL,
                is_system TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS announcements (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(150) NOT NULL,
                body TEXT NOT NULL,
                image_url VARCHAR(255) NULL,
                action_url VARCHAR(255) NULL,
                target_segment VARCHAR(50) NOT NULL DEFAULT 'all',
                starts_at DATETIME NULL,
                ends_at DATETIME NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                dismissible TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_announcements_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS daily_stats (
                date DATE PRIMARY KEY,
                total_users INT UNSIGNED NOT NULL DEFAULT 0,
                new_users INT UNSIGNED NOT NULL DEFAULT 0,
                active_users_dau INT UNSIGNED NOT NULL DEFAULT 0,
                active_users_wau INT UNSIGNED NOT NULL DEFAULT 0,
                active_users_mau INT UNSIGNED NOT NULL DEFAULT 0,
                total_devices INT UNSIGNED NOT NULL DEFAULT 0,
                total_files INT UNSIGNED NOT NULL DEFAULT 0,
                total_storage_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
                push_sent INT UNSIGNED NOT NULL DEFAULT 0,
                push_opened INT UNSIGNED NOT NULL DEFAULT 0,
                data TEXT NULL,
                computed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS cron_runs (
                command_name VARCHAR(60) PRIMARY KEY,
                last_started_at DATETIME NOT NULL,
                last_completed_at DATETIME NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'running',
                duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
                error_message TEXT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS support_ticket_replies (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                ticket_id BIGINT UNSIGNED NOT NULL,
                sender_type VARCHAR(10) NOT NULL,
                sender_id BIGINT UNSIGNED NULL,
                message TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_replies_ticket (ticket_id),
                CONSTRAINT fk_replies_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS faq_articles (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                category VARCHAR(60) NOT NULL DEFAULT 'general',
                title_en VARCHAR(200) NOT NULL,
                title_bn VARCHAR(200) NOT NULL,
                content_en TEXT NOT NULL,
                content_bn TEXT NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                is_published TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_faq_cat_published (category, is_published, sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];

        foreach ($statements as $sql) {
            $this->db->query($sql);
        }

        // Seed system roles if not present
        $allPermissions = [
            'dashboard.view',
            'users.view', 'users.edit', 'users.disable', 'users.block', 'users.delete',
            'devices.view', 'devices.block', 'blocklist.manage',
            'push.view', 'push.send', 'push.send_all', 'push.automations',
            'announcements.manage', 'app_config.manage',
            'support.view', 'support.reply',
            'content.manage', 'files.view',
            'sms.view', 'sms.manage',
            'security.view', 'system.view', 'audit.view',
            'admins.manage', 'roles.manage', 'settings.manage', 'export.data'
        ];

        $roles = [
            [
                'name' => 'Super Admin',
                'slug' => 'super_admin',
                'permissions' => json_encode($allPermissions),
                'is_system' => 1,
            ],
            [
                'name' => 'Admin',
                'slug' => 'admin',
                'permissions' => json_encode(array_values(array_diff($allPermissions, ['admins.manage', 'roles.manage']))),
                'is_system' => 1,
            ],
            [
                'name' => 'Support',
                'slug' => 'support',
                'permissions' => json_encode(['dashboard.view', 'users.view', 'devices.view', 'support.view', 'support.reply', 'content.manage']),
                'is_system' => 1,
            ],
            [
                'name' => 'Marketing',
                'slug' => 'marketing',
                'permissions' => json_encode(['dashboard.view', 'push.view', 'push.send', 'push.send_all', 'push.automations', 'announcements.manage', 'content.manage']),
                'is_system' => 1,
            ],
            [
                'name' => 'Viewer',
                'slug' => 'viewer',
                'permissions' => json_encode(['dashboard.view', 'users.view', 'devices.view', 'files.view', 'audit.view', 'system.view']),
                'is_system' => 1,
            ],
        ];

        foreach ($roles as $role) {
            $this->db->table('admin_roles')->ignore(true)->insert($role);
        }

        // Seed basic FAQ articles (EN & BN)
        $faqs = [
            [
                'category' => 'general',
                'title_en' => 'What is Tohobil?',
                'title_bn' => 'তহবিল কী?',
                'content_en' => 'Tohobil is a modern, privacy-first personal finance app designed specifically for Bangladesh. It works completely offline and syncs safely to your private cloud.',
                'content_bn' => 'তহবিল হলো একটি আধুনিক ও নিরাপদ ব্যক্তিগত হিসাব ব্যবস্থাপনা অ্যাপ, যা বিশেষভাবে বাংলাদেশের ব্যবহারকারীদের জন্য তৈরি। এটি সম্পূর্ণ অফলাইনে কাজ করে এবং ক্লাউডে নিরাপদ ব্যাকআপ রাখে।',
                'sort_order' => 1,
                'is_published' => 1,
            ],
            [
                'category' => 'security',
                'title_en' => 'Is my financial data private?',
                'title_bn' => 'আমার আর্থিক তথ্য কি নিরাপদ ও গোপনীয়?',
                'content_en' => 'Yes. Tohobil encrypts your local database and respects your privacy. System administrators can never view your transaction amounts, private notes, or balances.',
                'content_bn' => 'হ্যাঁ। তহবিল আপনার ডিভাইসে সমস্ত তথ্য এনক্রিপ্ট করে রাখে। কোনো অ্যাডমিন আপনার লেনদেনের পরিমাণ, ব্যক্তিগত নোট বা ব্যালেন্স দেখতে পায় না।',
                'sort_order' => 2,
                'is_published' => 1,
            ],
            [
                'category' => 'backup',
                'title_en' => 'How can I back up my data offline?',
                'title_bn' => 'কীভাবে অফলাইনে ব্যাকআপ ফাইল সংরক্ষণ করব?',
                'content_en' => 'Go to More > Backup and Data Portability, choose Encrypted Offline Backup (.tohobil), set a secure passphrase, and export your file.',
                'content_bn' => 'মোর > ব্যাকআপ ও ডেটা স্থানান্তর মেন্যুতে যান, এনক্রিপ্ট করা অফলাইন ব্যাকআপ (.tohobil) নির্বাচন করুন এবং একটি গোপন পাসফ্রেজ দিয়ে ব্যাকআপ ফাইল সংরক্ষণ করুন।',
                'sort_order' => 3,
                'is_published' => 1,
            ],
        ];

        foreach ($faqs as $faq) {
            $this->db->table('faq_articles')->ignore(true)->insert($faq);
        }
    }

    public function down()
    {
        $this->db->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach ([
            'faq_articles',
            'support_ticket_replies',
            'cron_runs',
            'daily_stats',
            'announcements',
            'admin_roles',
            'admin_sessions',
            'admins',
        ] as $table) {
            $this->db->query("DROP TABLE IF EXISTS {$table}");
        }
        $this->db->query("SET FOREIGN_KEY_CHECKS = 1");
    }
}
