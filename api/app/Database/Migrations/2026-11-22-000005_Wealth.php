<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Wealth extends Migration
{
    public function up()
    {
        $statements = [
            // Assets & Investments (FDR, DPS, Sanchayapatra, gold, land, shares, crypto, other)
            "CREATE TABLE IF NOT EXISTS assets (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                type VARCHAR(30) NOT NULL,
                name VARCHAR(160) NOT NULL,
                institution VARCHAR(120) NULL,
                principal BIGINT NOT NULL DEFAULT 0,
                current_value BIGINT NOT NULL DEFAULT 0,
                profit_rate DECIMAL(6,2) NULL,
                start_date BIGINT NOT NULL,
                maturity_date BIGINT NULL,
                unit VARCHAR(60) NULL,
                currency CHAR(3) NOT NULL,
                note TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_assets_user_rev (user_id, server_rev),
                INDEX idx_assets_book_type (book_id, type),
                CONSTRAINT fk_assets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Asset valuations history
            "CREATE TABLE IF NOT EXISTS asset_valuations (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                asset_id CHAR(36) NOT NULL,
                date BIGINT NOT NULL,
                value BIGINT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_valuations_user_rev (user_id, server_rev),
                INDEX idx_valuations_asset_date (asset_id, date),
                CONSTRAINT fk_valuations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Exchange rates table
            "CREATE TABLE IF NOT EXISTS exchange_rates (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                base CHAR(3) NOT NULL,
                quote CHAR(3) NOT NULL,
                rate DECIMAL(16,6) NOT NULL,
                date BIGINT NOT NULL,
                source VARCHAR(20) NOT NULL DEFAULT 'server',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_rates_user_rev (user_id, server_rev),
                INDEX idx_rates_book_pair (book_id, base, quote),
                CONSTRAINT fk_rates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];

        foreach ($statements as $sql) {
            $this->db->query($sql);
        }

        // Alter transactions to add asset_id and exchange_rate if not present
        if ($this->db->tableExists('transactions')) {
            $fields = $this->db->getFieldNames('transactions');
            if (!in_array('asset_id', $fields, true)) {
                $this->db->query("ALTER TABLE transactions ADD COLUMN asset_id CHAR(36) NULL AFTER goal_id");
            }
            if (!in_array('exchange_rate', $fields, true)) {
                $this->db->query("ALTER TABLE transactions ADD COLUMN exchange_rate DECIMAL(16,6) NULL AFTER fee");
            }
        }
    }

    public function down()
    {
        $this->db->query("DROP TABLE IF EXISTS exchange_rates");
        $this->db->query("DROP TABLE IF EXISTS asset_valuations");
        $this->db->query("DROP TABLE IF EXISTS assets");

        if ($this->db->tableExists('transactions')) {
            $fields = $this->db->getFieldNames('transactions');
            if (in_array('asset_id', $fields, true)) {
                $this->db->query("ALTER TABLE transactions DROP COLUMN asset_id");
            }
            if (in_array('exchange_rate', $fields, true)) {
                $this->db->query("ALTER TABLE transactions DROP COLUMN exchange_rate");
            }
        }
    }
}
