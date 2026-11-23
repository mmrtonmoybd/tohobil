<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AdminSessionSecurity extends Migration
{
    public function up()
    {
        $this->db->query('ALTER TABLE admins ADD COLUMN last_totp_step BIGINT NULL');
        $this->db->query('ALTER TABLE admin_sessions ADD COLUMN csrf_token CHAR(64) NOT NULL DEFAULT \'\'');
        // Pre-migration bearer sessions have no CSRF token and must not survive the switch to cookies.
        $this->db->query('DELETE FROM admin_sessions');
        $this->db->query("CREATE TABLE IF NOT EXISTS admin_login_challenges (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            admin_id BIGINT UNSIGNED NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            purpose VARCHAR(16) NOT NULL,
            attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_challenges_admin (admin_id),
            INDEX idx_challenges_expires (expires_at),
            CONSTRAINT fk_challenges_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        $this->db->query('DROP TABLE IF EXISTS admin_login_challenges');
        $this->db->query('ALTER TABLE admin_sessions DROP COLUMN csrf_token');
        $this->db->query('ALTER TABLE admins DROP COLUMN last_totp_step');
    }
}
