<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class Planning extends Migration
{
    public function up()
    {
        $statements = [
            // Recurring Rules (bills, recurring expenses/incomes/transfers, subscriptions)
            "CREATE TABLE IF NOT EXISTS recurring_rules (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                name VARCHAR(120) NOT NULL,
                type VARCHAR(20) NOT NULL,
                amount BIGINT NOT NULL,
                currency CHAR(3) NOT NULL,
                account_id CHAR(36) NOT NULL,
                to_account_id CHAR(36) NULL,
                category_id CHAR(36) NULL,
                person_id CHAR(36) NULL,
                note TEXT NOT NULL,
                frequency VARCHAR(20) NOT NULL,
                interval_step INT NOT NULL DEFAULT 1,
                by_day VARCHAR(60) NULL,
                start_date BIGINT NOT NULL,
                end_date BIGINT NULL,
                max_count INT NULL,
                current_count INT NOT NULL DEFAULT 0,
                mode VARCHAR(20) NOT NULL DEFAULT 'remind',
                next_run_at BIGINT NOT NULL,
                is_subscription TINYINT(1) NOT NULL DEFAULT 0,
                icon VARCHAR(60) NULL,
                color VARCHAR(30) NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_recurring_user_rev (user_id, server_rev),
                INDEX idx_recurring_book_next (book_id, next_run_at),
                CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Budgets (per-category and overall monthly, optional rollover)
            "CREATE TABLE IF NOT EXISTS budgets (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                category_id CHAR(36) NULL,
                amount BIGINT NOT NULL,
                currency CHAR(3) NOT NULL,
                period VARCHAR(20) NOT NULL DEFAULT 'monthly',
                rollover TINYINT(1) NOT NULL DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_budgets_user_rev (user_id, server_rev),
                INDEX idx_budgets_book (book_id, period, category_id),
                CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

            // Goals (target savings goals, deadlines, celebration)
            "CREATE TABLE IF NOT EXISTS goals (
                id CHAR(36) PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                book_id CHAR(36) NOT NULL,
                name VARCHAR(120) NOT NULL,
                icon VARCHAR(60) NOT NULL,
                color VARCHAR(30) NOT NULL,
                target_amount BIGINT NOT NULL,
                currency CHAR(3) NOT NULL,
                target_date BIGINT NOT NULL,
                linked_account_id CHAR(36) NULL,
                current_amount BIGINT NOT NULL DEFAULT 0,
                achieved_at BIGINT NULL,
                note TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                deleted_at BIGINT NULL,
                server_rev BIGINT NOT NULL,
                INDEX idx_goals_user_rev (user_id, server_rev),
                INDEX idx_goals_book (book_id, achieved_at, target_date),
                CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];

        foreach ($statements as $sql) {
            $this->db->query($sql);
        }

        // Alter transactions to add recurring_rule_id and goal_id if not present
        if ($this->db->tableExists('transactions')) {
            $fields = $this->db->getFieldNames('transactions');
            if (!in_array('recurring_rule_id', $fields, true)) {
                $this->db->query("ALTER TABLE transactions ADD COLUMN recurring_rule_id CHAR(36) NULL AFTER parent_id");
            }
            if (!in_array('goal_id', $fields, true)) {
                $this->db->query("ALTER TABLE transactions ADD COLUMN goal_id CHAR(36) NULL AFTER recurring_rule_id");
            }
        }
    }

    public function down()
    {
        $this->db->query("DROP TABLE IF EXISTS goals");
        $this->db->query("DROP TABLE IF EXISTS budgets");
        $this->db->query("DROP TABLE IF EXISTS recurring_rules");

        if ($this->db->tableExists('transactions')) {
            $fields = $this->db->getFieldNames('transactions');
            if (in_array('goal_id', $fields, true)) {
                $this->db->query("ALTER TABLE transactions DROP COLUMN goal_id");
            }
            if (in_array('recurring_rule_id', $fields, true)) {
                $this->db->query("ALTER TABLE transactions DROP COLUMN recurring_rule_id");
            }
        }
    }
}
