<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class PushQueueAndInboxState extends Migration
{
    public function up()
    {
        $this->db->query("CREATE TABLE IF NOT EXISTS push_jobs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            campaign_id BIGINT UNSIGNED NOT NULL,
            kind VARCHAR(16) NOT NULL,
            payload LONGTEXT NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
            available_at DATETIME NOT NULL,
            locked_at DATETIME NULL,
            last_error VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_push_jobs_ready (status, available_at),
            INDEX idx_push_jobs_campaign (campaign_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $this->db->query("CREATE TABLE IF NOT EXISTS push_deliveries (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            campaign_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            device_id BIGINT UNSIGNED NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
            last_error VARCHAR(255) NULL,
            sent_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY idx_push_delivery_device (campaign_id, device_id),
            INDEX idx_push_delivery_user (user_id, campaign_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $this->db->query("CREATE TABLE IF NOT EXISTS notification_user_state (
            user_id BIGINT UNSIGNED NOT NULL,
            notification_id BIGINT UNSIGNED NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            read_at DATETIME NULL,
            deleted_at DATETIME NULL,
            PRIMARY KEY (user_id, notification_id),
            CONSTRAINT fk_notification_state_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_notification_state_notification FOREIGN KEY (notification_id) REFERENCES inbox_notifications(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        $this->db->query('DROP TABLE IF EXISTS notification_user_state');
        $this->db->query('DROP TABLE IF EXISTS push_deliveries');
        $this->db->query('DROP TABLE IF EXISTS push_jobs');
    }
}
