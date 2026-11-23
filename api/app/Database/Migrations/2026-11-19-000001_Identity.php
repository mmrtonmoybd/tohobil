<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Identity extends Migration
{
    public function up()
    {
        $sql = [
            "CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, phone VARCHAR(20) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, name VARCHAR(120) NOT NULL, email VARCHAR(190) NULL, email_verified_at DATETIME NULL, occupation VARCHAR(120) NULL, birth_date DATE NULL, city VARCHAR(120) NULL, country CHAR(2) NOT NULL DEFAULT 'BD', currency CHAR(3) NOT NULL DEFAULT 'BDT', language CHAR(2) NOT NULL DEFAULT 'en', photo_path VARCHAR(255) NULL, status VARCHAR(16) NOT NULL DEFAULT 'active', status_reason VARCHAR(255) NULL, status_until DATETIME NULL, last_seen_at DATETIME NULL, last_ip VARCHAR(45) NULL, platform VARCHAR(20) NULL, app_version VARCHAR(30) NULL, marketing_push_opt_in TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS devices (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, device_uid VARCHAR(150) NOT NULL, installation_id CHAR(36) NOT NULL, platform VARCHAR(20) NOT NULL, manufacturer VARCHAR(120) NULL, model VARCHAR(120) NULL, os_version VARCHAR(60) NULL, app_version VARCHAR(30) NULL, language CHAR(2) NULL, push_token VARCHAR(255) NULL, first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_ip VARCHAR(45) NULL, status VARCHAR(16) NOT NULL DEFAULT 'active', status_reason VARCHAR(255) NULL, UNIQUE KEY(user_id, installation_id), INDEX(device_uid), CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS auth_tokens (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, device_id BIGINT UNSIGNED NULL, token_hash CHAR(64) NOT NULL UNIQUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL, revoked_at DATETIME NULL, last_used_at DATETIME NULL, INDEX(user_id), CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_tokens_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS otp_codes (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, phone VARCHAR(20) NOT NULL, purpose VARCHAR(24) NOT NULL, code_hash CHAR(64) NOT NULL, user_id BIGINT UNSIGNED NULL, expires_at DATETIME NOT NULL, consumed_at DATETIME NULL, attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(phone,purpose,created_at), CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS blocklist (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, type VARCHAR(12) NOT NULL, value VARCHAR(150) NOT NULL, reason VARCHAR(255) NULL, expires_at DATETIME NULL, created_by BIGINT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY(type,value)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS app_config (config_key VARCHAR(80) PRIMARY KEY, config_value TEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS audit_log (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NULL, event VARCHAR(80) NOT NULL, ip VARCHAR(45) NULL, details VARCHAR(255) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(user_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS support_tickets (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NULL, name VARCHAR(120) NULL, email VARCHAR(190) NULL, phone VARCHAR(20) NULL, subject VARCHAR(150) NULL, message TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'new', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(user_id,created_at), CONSTRAINT fk_support_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];
        foreach ($sql as $statement) {
            $this->db->query($statement);
        }
        foreach ([
            'maintenance'            => 'false',
            'maintenance_message'    => 'Tohobil is currently undergoing scheduled maintenance. Please check back shortly.',
            'min_android_version'    => '0.0.0',
            'latest_android_version' => '0.1.0',
            'update_message'         => 'Please update Tohobil from Google Play to continue.',
            'support_email'          => 'support@tohobil.app',
            'play_store_url'         => 'https://play.google.com/store/apps/details?id=com.tohobil.app',
            'feature_flags'          => '{}',
        ] as $key => $value) {
            $this->db->table('app_config')->ignore(true)->insert(['config_key' => $key, 'config_value' => $value]);
        }
    }

    public function down()
    {
        $this->db->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach (['support_tickets', 'audit_log', 'app_config', 'blocklist', 'otp_codes', 'auth_tokens', 'devices', 'users'] as $table) {
            $this->db->query("DROP TABLE IF EXISTS {$table}");
        }
        $this->db->query("SET FOREIGN_KEY_CHECKS = 1");
    }
}
