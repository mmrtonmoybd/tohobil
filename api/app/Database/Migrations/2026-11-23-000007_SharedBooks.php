<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class SharedBooks extends Migration
{
    public function up()
    {
        $this->db->query("CREATE TABLE IF NOT EXISTS book_invitations (
            id CHAR(36) PRIMARY KEY,
            book_id CHAR(36) NOT NULL,
            book_name VARCHAR(120) NOT NULL,
            inviter_user_id BIGINT UNSIGNED NOT NULL,
            inviter_name VARCHAR(120) NOT NULL,
            invitee_phone VARCHAR(20) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'editor',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_invitations_invitee (invitee_phone, status),
            INDEX idx_invitations_book (book_id),
            CONSTRAINT fk_invitations_inviter FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function down()
    {
        $this->db->query("DROP TABLE IF EXISTS book_invitations");
    }
}
