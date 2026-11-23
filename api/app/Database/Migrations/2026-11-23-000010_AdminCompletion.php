<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AdminCompletion extends Migration
{
    public function up()
    {
        $userColumns = $this->db->getFieldNames('users');
        if (!in_array('phone_verified_at', $userColumns, true)) {
            $this->db->query('ALTER TABLE users ADD COLUMN phone_verified_at DATETIME NULL');
        }
        if (!in_array('storage_quota_bytes', $userColumns, true)) {
            $this->db->query('ALTER TABLE users ADD COLUMN storage_quota_bytes BIGINT UNSIGNED NULL');
        }
        if (!in_array('deletion_requested_at', $userColumns, true)) {
            $this->db->query('ALTER TABLE users ADD COLUMN deletion_requested_at DATETIME NULL');
        }

        $campaignColumns = $this->db->getFieldNames('push_campaigns');
        if (!in_array('source_automation_id', $campaignColumns, true)) {
            $this->db->query('ALTER TABLE push_campaigns ADD COLUMN source_automation_id BIGINT UNSIGNED NULL');
        }

        $this->db->query("CREATE TABLE IF NOT EXISTS user_status_history (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            status VARCHAR(16) NOT NULL,
            reason VARCHAR(255) NULL,
            status_until DATETIME NULL,
            admin_id BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status_history_user (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->db->query("CREATE TABLE IF NOT EXISTS admin_notes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            admin_id BIGINT UNSIGNED NULL,
            note VARCHAR(500) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_admin_notes_user (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->db->query("CREATE TABLE IF NOT EXISTS push_templates (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(80) NOT NULL,
            category VARCHAR(32) NOT NULL DEFAULT 'announcement',
            title_en VARCHAR(150) NOT NULL,
            title_bn VARCHAR(150) NULL,
            body_en TEXT NOT NULL,
            body_bn TEXT NULL,
            logo_mode VARCHAR(16) NOT NULL DEFAULT 'none',
            action_type VARCHAR(32) NOT NULL DEFAULT 'open_app',
            action_value VARCHAR(255) NULL,
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->db->query("CREATE TABLE IF NOT EXISTS push_automations (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(80) NOT NULL,
            enabled TINYINT(1) NOT NULL DEFAULT 0,
            template_id BIGINT UNSIGNED NOT NULL,
            rule VARCHAR(32) NOT NULL,
            rule_value VARCHAR(40) NOT NULL,
            cap_per_week TINYINT UNSIGNED NOT NULL DEFAULT 2,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->db->query("CREATE TABLE IF NOT EXISTS sms_log (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            phone VARCHAR(20) NOT NULL,
            purpose VARCHAR(32) NOT NULL,
            masked_body VARCHAR(160) NOT NULL,
            status VARCHAR(16) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sms_log_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $this->db->query("CREATE TABLE IF NOT EXISTS admin_password_resets (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            admin_id BIGINT UNSIGNED NOT NULL,
            token_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_admin_reset_token (token_hash),
            INDEX idx_admin_reset_admin (admin_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        $this->db->query('DROP TABLE IF EXISTS admin_password_resets');
        $this->db->query('DROP TABLE IF EXISTS sms_log');
        $this->db->query('DROP TABLE IF EXISTS push_automations');
        $this->db->query('DROP TABLE IF EXISTS push_templates');
        $this->db->query('DROP TABLE IF EXISTS admin_notes');
        $this->db->query('DROP TABLE IF EXISTS user_status_history');
    }
}
