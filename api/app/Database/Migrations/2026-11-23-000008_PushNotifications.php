<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class PushNotifications extends Migration
{
    public function up()
    {
        $statements = [
            "CREATE TABLE IF NOT EXISTS push_campaigns (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                category VARCHAR(32) NOT NULL DEFAULT 'announcement',
                title_en VARCHAR(150) NOT NULL,
                title_bn VARCHAR(150) NULL,
                body_en TEXT NOT NULL,
                body_bn TEXT NULL,
                image_url VARCHAR(255) NULL,
                logo_mode VARCHAR(16) NOT NULL DEFAULT 'none',
                logo_url VARCHAR(255) NULL,
                action_type VARCHAR(32) NOT NULL DEFAULT 'open_app',
                action_value VARCHAR(255) NULL,
                target VARCHAR(32) NOT NULL DEFAULT 'all',
                target_filters TEXT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'draft',
                scheduled_at DATETIME NULL,
                sent_at DATETIME NULL,
                sent_count INT UNSIGNED NOT NULL DEFAULT 0,
                failed_count INT UNSIGNED NOT NULL DEFAULT 0,
                opened_count INT UNSIGNED NOT NULL DEFAULT 0,
                created_by BIGINT UNSIGNED NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_campaigns_status (status),
                INDEX idx_campaigns_scheduled (scheduled_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS inbox_notifications (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NULL,
                campaign_id BIGINT UNSIGNED NULL,
                type VARCHAR(32) NOT NULL DEFAULT 'announcement',
                title VARCHAR(150) NOT NULL,
                body TEXT NOT NULL,
                image_url VARCHAR(255) NULL,
                action_type VARCHAR(32) NULL,
                action_value VARCHAR(255) NULL,
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                read_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME NULL,
                INDEX idx_inbox_user_created (user_id, created_at),
                INDEX idx_inbox_is_read (is_read),
                INDEX idx_inbox_campaign (campaign_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            "CREATE TABLE IF NOT EXISTS push_events (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                campaign_id BIGINT UNSIGNED NULL,
                user_id BIGINT UNSIGNED NULL,
                device_id BIGINT UNSIGNED NULL,
                opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_push_events_campaign (campaign_id),
                INDEX idx_push_events_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];

        foreach ($statements as $sql) {
            $this->db->query($sql);
        }
    }

    public function down()
    {
        $this->db->query("DROP TABLE IF EXISTS push_events");
        $this->db->query("DROP TABLE IF EXISTS inbox_notifications");
        $this->db->query("DROP TABLE IF EXISTS push_campaigns");
    }
}
