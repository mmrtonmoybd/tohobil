<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AttachmentsAndVault extends Migration
{
    public function up()
    {
        $statements = [
            // Files table for actual uploaded assets stored on server
            "CREATE TABLE IF NOT EXISTS files (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                thumb_path VARCHAR(255) NULL,
                mime_type VARCHAR(100) NOT NULL,
                file_size BIGINT UNSIGNED NOT NULL,
                sha256 CHAR(64) NOT NULL,
                width INT NULL,
                height INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted_at DATETIME NULL,
                INDEX idx_files_user (user_id),
                INDEX idx_files_user_sha (user_id, sha256),
                CONSTRAINT fk_files_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Attachments table (syncable metadata linking records to files)
            "CREATE TABLE IF NOT EXISTS attachments (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                entity_type VARCHAR(40) NOT NULL,
                entity_id CHAR(36) NOT NULL,
                kind VARCHAR(20) NOT NULL,
                mime VARCHAR(100) NOT NULL,
                size BIGINT NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                sha256 CHAR(64) NOT NULL,
                width INT NULL,
                height INT NULL,
                remote_id CHAR(36) NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_attachments_user_rev (user_id, server_rev),
                INDEX idx_attachments_entity (entity_type, entity_id),
                INDEX idx_attachments_book_rev (book_id, server_rev),
                CONSTRAINT fk_attachments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Documents table (syncable Document Vault records)
            "CREATE TABLE IF NOT EXISTS documents (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                title VARCHAR(190) NOT NULL,
                folder VARCHAR(40) NOT NULL,
                date BIGINT NOT NULL,
                expiry_date BIGINT NULL,
                tags TEXT NULL,
                note TEXT NOT NULL,
                entity_type VARCHAR(40) NULL,
                entity_id CHAR(36) NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_documents_user_rev (user_id, server_rev),
                INDEX idx_documents_book_rev (book_id, server_rev),
                INDEX idx_documents_folder (book_id, folder),
                CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];

        foreach ($statements as $sql) {
            $this->db->query($sql);
        }
    }

    public function down()
    {
        $this->db->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach (['documents', 'attachments', 'files'] as $table) {
            $this->db->query("DROP TABLE IF EXISTS {$table}");
        }
        $this->db->query("SET FOREIGN_KEY_CHECKS = 1");
    }
}
