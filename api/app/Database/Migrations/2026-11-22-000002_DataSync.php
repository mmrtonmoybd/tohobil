<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class DataSync extends Migration
{
    public function up()
    {
        $statements = [
            // Revision tracking table
            "CREATE TABLE IF NOT EXISTS user_sync_revisions (
                user_id BIGINT UNSIGNED PRIMARY KEY,
                current_rev BIGINT UNSIGNED NOT NULL DEFAULT 0,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_sync_rev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Books
            "CREATE TABLE IF NOT EXISTS books (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                name VARCHAR(120) NOT NULL,
                icon VARCHAR(60) NOT NULL,
                color VARCHAR(30) NOT NULL,
                currency CHAR(3) NOT NULL,
                is_default TINYINT(1) NOT NULL DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_books_user_rev (user_id, server_rev),
                INDEX idx_books_user_default (user_id, is_default),
                CONSTRAINT fk_books_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Book members (for shared books in future)
            "CREATE TABLE IF NOT EXISTS book_members (
                id CHAR(36) PRIMARY KEY,
                book_id CHAR(36) NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'owner',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_book_members_user_rev (user_id, server_rev),
                INDEX idx_book_members_book_rev (book_id, server_rev),
                CONSTRAINT fk_book_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Accounts
            "CREATE TABLE IF NOT EXISTS accounts (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                name VARCHAR(120) NOT NULL,
                type VARCHAR(30) NOT NULL,
                provider VARCHAR(80) NULL,
                currency CHAR(3) NOT NULL,
                opening_balance BIGINT NOT NULL DEFAULT 0,
                color VARCHAR(30) NOT NULL,
                icon VARCHAR(60) NOT NULL,
                include_in_total TINYINT(1) NOT NULL DEFAULT 1,
                is_archived TINYINT(1) NOT NULL DEFAULT 0,
                sort_order INT NOT NULL DEFAULT 0,
                credit_limit BIGINT NULL,
                statement_day SMALLINT NULL,
                due_day SMALLINT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_accounts_user_rev (user_id, server_rev),
                INDEX idx_accounts_book_rev (book_id, server_rev),
                INDEX idx_accounts_sort (book_id, is_archived, sort_order),
                CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Categories
            "CREATE TABLE IF NOT EXISTS categories (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                name VARCHAR(120) NULL,
                i18n_key VARCHAR(80) NULL,
                kind VARCHAR(20) NOT NULL,
                parent_id CHAR(36) NULL,
                icon VARCHAR(60) NOT NULL,
                color VARCHAR(30) NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                is_default TINYINT(1) NOT NULL DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_categories_user_rev (user_id, server_rev),
                INDEX idx_categories_book_rev (book_id, server_rev),
                CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Tags
            "CREATE TABLE IF NOT EXISTS tags (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                name VARCHAR(80) NOT NULL,
                color VARCHAR(30) NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_tags_user_rev (user_id, server_rev),
                INDEX idx_tags_book_rev (book_id, server_rev),
                CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // People
            "CREATE TABLE IF NOT EXISTS people (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                name VARCHAR(120) NOT NULL,
                phone VARCHAR(30) NULL,
                note TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_people_user_rev (user_id, server_rev),
                INDEX idx_people_book_rev (book_id, server_rev),
                CONSTRAINT fk_people_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Debts
            "CREATE TABLE IF NOT EXISTS debts (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                person_id CHAR(36) NOT NULL,
                direction VARCHAR(20) NOT NULL,
                amount BIGINT NOT NULL,
                currency CHAR(3) NOT NULL,
                date BIGINT NOT NULL,
                due_date BIGINT NULL,
                interest_rate_bps INT NOT NULL DEFAULT 0,
                note TEXT NOT NULL,
                settled_at BIGINT NULL,
                write_off_amount BIGINT NOT NULL DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_debts_user_rev (user_id, server_rev),
                INDEX idx_debts_book_rev (book_id, server_rev),
                CONSTRAINT fk_debts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Debt entries
            "CREATE TABLE IF NOT EXISTS debt_entries (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                debt_id CHAR(36) NOT NULL,
                kind VARCHAR(20) NOT NULL,
                amount BIGINT NOT NULL,
                currency CHAR(3) NOT NULL,
                account_id CHAR(36) NULL,
                occurred_at BIGINT NOT NULL,
                note TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_debt_entries_user_rev (user_id, server_rev),
                INDEX idx_debt_entries_book_rev (book_id, server_rev),
                CONSTRAINT fk_debt_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Debt installments
            "CREATE TABLE IF NOT EXISTS debt_installments (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                debt_id CHAR(36) NOT NULL,
                due_date BIGINT NOT NULL,
                amount BIGINT NOT NULL,
                paid_amount BIGINT NOT NULL DEFAULT 0,
                paid_event_id CHAR(36) NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_debt_inst_user_rev (user_id, server_rev),
                INDEX idx_debt_inst_book_rev (book_id, server_rev),
                CONSTRAINT fk_debt_inst_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Transactions
            "CREATE TABLE IF NOT EXISTS transactions (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                type VARCHAR(30) NOT NULL,
                amount BIGINT NOT NULL,
                currency CHAR(3) NOT NULL,
                account_id CHAR(36) NOT NULL,
                to_account_id CHAR(36) NULL,
                fee BIGINT NOT NULL DEFAULT 0,
                category_id CHAR(36) NULL,
                occurred_at BIGINT NOT NULL,
                note TEXT NOT NULL,
                parent_id CHAR(36) NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_transactions_user_rev (user_id, server_rev),
                INDEX idx_transactions_book_rev (book_id, server_rev),
                INDEX idx_transactions_account (account_id, occurred_at),
                CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Transaction tags
            "CREATE TABLE IF NOT EXISTS transaction_tags (
                transaction_id CHAR(36) NOT NULL,
                tag_id CHAR(36) NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL,
                created_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                PRIMARY KEY (transaction_id, tag_id),
                INDEX idx_tr_tags_user_rev (user_id, server_rev),
                CONSTRAINT fk_tr_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Favorites
            "CREATE TABLE IF NOT EXISTS favorites (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                name VARCHAR(120) NOT NULL,
                type VARCHAR(20) NOT NULL,
                amount BIGINT NOT NULL,
                account_id CHAR(36) NOT NULL,
                category_id CHAR(36) NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_favorites_user_rev (user_id, server_rev),
                INDEX idx_favorites_book_rev (book_id, server_rev),
                CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // User Settings
            "CREATE TABLE IF NOT EXISTS user_settings (
                user_id BIGINT UNSIGNED PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at BIGINT NOT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_user_settings_rev (user_id, server_rev),
                CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];

        foreach ($statements as $sql) {
            $this->db->query($sql);
        }
    }

    public function down()
    {
        $this->db->query("SET FOREIGN_KEY_CHECKS = 0");
        $tables = [
            'user_settings',
            'favorites',
            'transaction_tags',
            'transactions',
            'debt_installments',
            'debt_entries',
            'debts',
            'people',
            'tags',
            'categories',
            'accounts',
            'book_members',
            'books',
            'user_sync_revisions',
        ];
        foreach ($tables as $table) {
            $this->db->query("DROP TABLE IF EXISTS {$table}");
        }
        $this->db->query("SET FOREIGN_KEY_CHECKS = 1");
    }
}
