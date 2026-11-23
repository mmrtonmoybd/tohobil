/*M!999999\- enable the sandbox mode */ 
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` varchar(30) NOT NULL,
  `provider` varchar(80) DEFAULT NULL,
  `currency` char(3) NOT NULL,
  `opening_balance` bigint(20) NOT NULL DEFAULT 0,
  `color` varchar(30) NOT NULL,
  `icon` varchar(60) NOT NULL,
  `include_in_total` tinyint(1) NOT NULL DEFAULT 1,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `credit_limit` bigint(20) DEFAULT NULL,
  `statement_day` smallint(6) DEFAULT NULL,
  `due_day` smallint(6) DEFAULT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_accounts_user_rev` (`user_id`,`server_rev`),
  KEY `idx_accounts_book_rev` (`book_id`,`server_rev`),
  KEY `idx_accounts_sort` (`book_id`,`is_archived`,`sort_order`),
  CONSTRAINT `fk_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_roles` (
  `id` bigint(20) unsigned NOT NULL,
  `name` varchar(60) NOT NULL,
  `slug` varchar(32) NOT NULL,
  `permissions` text NOT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_sessions` (
  `id` bigint(20) unsigned NOT NULL,
  `admin_id` bigint(20) unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `last_active_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_admin_sessions_admin` (`admin_id`),
  CONSTRAINT `fk_admin_sessions_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` bigint(20) unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(32) NOT NULL DEFAULT 'admin',
  `totp_secret` varchar(64) DEFAULT NULL,
  `is_2fa_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `failed_logins` smallint(5) unsigned NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_admins_status` (`status`),
  KEY `idx_admins_role` (`role`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `announcements` (
  `id` bigint(20) unsigned NOT NULL,
  `title` varchar(150) NOT NULL,
  `body` text NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `action_url` varchar(255) DEFAULT NULL,
  `target_segment` varchar(50) NOT NULL DEFAULT 'all',
  `starts_at` datetime DEFAULT NULL,
  `ends_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `dismissible` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_announcements_active` (`is_active`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_config` (
  `config_key` varchar(80) NOT NULL,
  `config_value` text NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`config_key`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_valuations` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `asset_id` char(36) NOT NULL,
  `date` bigint(20) NOT NULL,
  `value` bigint(20) NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_valuations_user_rev` (`user_id`,`server_rev`),
  KEY `idx_valuations_asset_date` (`asset_id`,`date`),
  CONSTRAINT `fk_valuations_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `type` varchar(30) NOT NULL,
  `name` varchar(160) NOT NULL,
  `institution` varchar(120) DEFAULT NULL,
  `principal` bigint(20) NOT NULL DEFAULT 0,
  `current_value` bigint(20) NOT NULL DEFAULT 0,
  `profit_rate` decimal(6,2) DEFAULT NULL,
  `start_date` bigint(20) NOT NULL,
  `maturity_date` bigint(20) DEFAULT NULL,
  `unit` varchar(60) DEFAULT NULL,
  `currency` char(3) NOT NULL,
  `note` text NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assets_user_rev` (`user_id`,`server_rev`),
  KEY `idx_assets_book_type` (`book_id`,`type`),
  CONSTRAINT `fk_assets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `entity_type` varchar(40) NOT NULL,
  `entity_id` char(36) NOT NULL,
  `kind` varchar(20) NOT NULL,
  `mime` varchar(100) NOT NULL,
  `size` bigint(20) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `sha256` char(64) NOT NULL,
  `width` int(11) DEFAULT NULL,
  `height` int(11) DEFAULT NULL,
  `remote_id` char(36) DEFAULT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_attachments_user_rev` (`user_id`,`server_rev`),
  KEY `idx_attachments_entity` (`entity_type`,`entity_id`),
  KEY `idx_attachments_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_attachments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `event` varchar(80) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `details` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`,`created_at`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_tokens` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `device_id` bigint(20) unsigned DEFAULT NULL,
  `token_hash` char(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `user_id` (`user_id`),
  KEY `fk_tokens_device` (`device_id`),
  CONSTRAINT `fk_tokens_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocklist` (
  `id` bigint(20) unsigned NOT NULL,
  `type` varchar(12) NOT NULL,
  `value` varchar(150) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `type` (`type`,`value`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `book_invitations` (
  `id` char(36) NOT NULL,
  `book_id` char(36) NOT NULL,
  `book_name` varchar(120) NOT NULL,
  `inviter_user_id` bigint(20) unsigned NOT NULL,
  `inviter_name` varchar(120) NOT NULL,
  `invitee_phone` varchar(20) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'editor',
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_invitations_invitee` (`invitee_phone`,`status`),
  KEY `idx_invitations_book` (`book_id`),
  KEY `fk_invitations_inviter` (`inviter_user_id`),
  CONSTRAINT `fk_invitations_inviter` FOREIGN KEY (`inviter_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `book_members` (
  `id` char(36) NOT NULL,
  `book_id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'owner',
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_book_members_user_rev` (`user_id`,`server_rev`),
  KEY `idx_book_members_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_book_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `books` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `icon` varchar(60) NOT NULL,
  `color` varchar(30) NOT NULL,
  `currency` char(3) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_books_user_rev` (`user_id`,`server_rev`),
  KEY `idx_books_user_default` (`user_id`,`is_default`),
  CONSTRAINT `fk_books_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `budgets` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `category_id` char(36) DEFAULT NULL,
  `amount` bigint(20) NOT NULL,
  `currency` char(3) NOT NULL,
  `period` varchar(20) NOT NULL DEFAULT 'monthly',
  `rollover` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_budgets_user_rev` (`user_id`,`server_rev`),
  KEY `idx_budgets_book` (`book_id`,`period`,`category_id`),
  CONSTRAINT `fk_budgets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `name` varchar(120) DEFAULT NULL,
  `i18n_key` varchar(80) DEFAULT NULL,
  `kind` varchar(20) NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `icon` varchar(60) NOT NULL,
  `color` varchar(30) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_categories_user_rev` (`user_id`,`server_rev`),
  KEY `idx_categories_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_categories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cron_runs` (
  `command_name` varchar(60) NOT NULL,
  `last_started_at` datetime NOT NULL,
  `last_completed_at` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'running',
  `duration_ms` int(10) unsigned NOT NULL DEFAULT 0,
  `error_message` text DEFAULT NULL,
  PRIMARY KEY (`command_name`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_stats` (
  `date` date NOT NULL,
  `total_users` int(10) unsigned NOT NULL DEFAULT 0,
  `new_users` int(10) unsigned NOT NULL DEFAULT 0,
  `active_users_dau` int(10) unsigned NOT NULL DEFAULT 0,
  `active_users_wau` int(10) unsigned NOT NULL DEFAULT 0,
  `active_users_mau` int(10) unsigned NOT NULL DEFAULT 0,
  `total_devices` int(10) unsigned NOT NULL DEFAULT 0,
  `total_files` int(10) unsigned NOT NULL DEFAULT 0,
  `total_storage_bytes` bigint(20) unsigned NOT NULL DEFAULT 0,
  `push_sent` int(10) unsigned NOT NULL DEFAULT 0,
  `push_opened` int(10) unsigned NOT NULL DEFAULT 0,
  `data` text DEFAULT NULL,
  `computed_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`date`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `debt_entries` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `debt_id` char(36) NOT NULL,
  `kind` varchar(20) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `currency` char(3) NOT NULL,
  `account_id` char(36) DEFAULT NULL,
  `occurred_at` bigint(20) NOT NULL,
  `note` text NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_debt_entries_user_rev` (`user_id`,`server_rev`),
  KEY `idx_debt_entries_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_debt_entries_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `debt_installments` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `debt_id` char(36) NOT NULL,
  `due_date` bigint(20) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `paid_amount` bigint(20) NOT NULL DEFAULT 0,
  `paid_event_id` char(36) DEFAULT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_debt_inst_user_rev` (`user_id`,`server_rev`),
  KEY `idx_debt_inst_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_debt_inst_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `debts` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `person_id` char(36) NOT NULL,
  `direction` varchar(20) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `currency` char(3) NOT NULL,
  `date` bigint(20) NOT NULL,
  `due_date` bigint(20) DEFAULT NULL,
  `interest_rate_bps` int(11) NOT NULL DEFAULT 0,
  `note` text NOT NULL,
  `settled_at` bigint(20) DEFAULT NULL,
  `write_off_amount` bigint(20) NOT NULL DEFAULT 0,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_debts_user_rev` (`user_id`,`server_rev`),
  KEY `idx_debts_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_debts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `devices` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `device_uid` varchar(150) NOT NULL,
  `installation_id` char(36) NOT NULL,
  `platform` varchar(20) NOT NULL,
  `manufacturer` varchar(120) DEFAULT NULL,
  `model` varchar(120) DEFAULT NULL,
  `os_version` varchar(60) DEFAULT NULL,
  `app_version` varchar(30) DEFAULT NULL,
  `language` char(2) DEFAULT NULL,
  `push_token` varchar(255) DEFAULT NULL,
  `first_seen_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_seen_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_ip` varchar(45) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `status_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`installation_id`),
  KEY `device_uid` (`device_uid`),
  CONSTRAINT `fk_devices_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `title` varchar(190) NOT NULL,
  `folder` varchar(40) NOT NULL,
  `date` bigint(20) NOT NULL,
  `expiry_date` bigint(20) DEFAULT NULL,
  `tags` text DEFAULT NULL,
  `note` text NOT NULL,
  `entity_type` varchar(40) DEFAULT NULL,
  `entity_id` char(36) DEFAULT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_documents_user_rev` (`user_id`,`server_rev`),
  KEY `idx_documents_book_rev` (`book_id`,`server_rev`),
  KEY `idx_documents_folder` (`book_id`,`folder`),
  CONSTRAINT `fk_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `exchange_rates` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `base` char(3) NOT NULL,
  `quote` char(3) NOT NULL,
  `rate` decimal(16,6) NOT NULL,
  `date` bigint(20) NOT NULL,
  `source` varchar(20) NOT NULL DEFAULT 'server',
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rates_user_rev` (`user_id`,`server_rev`),
  KEY `idx_rates_book_pair` (`book_id`,`base`,`quote`),
  CONSTRAINT `fk_rates_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `factories` (
  `id` int(9) NOT NULL,
  `name` varchar(31) NOT NULL,
  `uid` varchar(31) NOT NULL,
  `class` varchar(63) NOT NULL,
  `icon` varchar(31) NOT NULL,
  `summary` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `name` (`name`),
  KEY `uid` (`uid`),
  KEY `deleted_at_id` (`deleted_at`,`id`),
  KEY `created_at` (`created_at`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `faq_articles` (
  `id` bigint(20) unsigned NOT NULL,
  `category` varchar(60) NOT NULL DEFAULT 'general',
  `title_en` varchar(200) NOT NULL,
  `title_bn` varchar(200) NOT NULL,
  `content_en` text NOT NULL,
  `content_bn` text NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_faq_cat_published` (`category`,`is_published`,`sort_order`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorites` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` varchar(20) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `account_id` char(36) NOT NULL,
  `category_id` char(36) DEFAULT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_favorites_user_rev` (`user_id`,`server_rev`),
  KEY `idx_favorites_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `files` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `thumb_path` varchar(255) DEFAULT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` bigint(20) unsigned NOT NULL,
  `sha256` char(64) NOT NULL,
  `width` int(11) DEFAULT NULL,
  `height` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_files_user` (`user_id`),
  KEY `idx_files_user_sha` (`user_id`,`sha256`),
  CONSTRAINT `fk_files_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `goals` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `icon` varchar(60) NOT NULL,
  `color` varchar(30) NOT NULL,
  `target_amount` bigint(20) NOT NULL,
  `currency` char(3) NOT NULL,
  `target_date` bigint(20) NOT NULL,
  `linked_account_id` char(36) DEFAULT NULL,
  `current_amount` bigint(20) NOT NULL DEFAULT 0,
  `achieved_at` bigint(20) DEFAULT NULL,
  `note` text NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_goals_user_rev` (`user_id`,`server_rev`),
  KEY `idx_goals_book` (`book_id`,`achieved_at`,`target_date`),
  CONSTRAINT `fk_goals_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inbox_notifications` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `campaign_id` bigint(20) unsigned DEFAULT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'announcement',
  `title` varchar(150) NOT NULL,
  `body` text NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `action_type` varchar(32) DEFAULT NULL,
  `action_value` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inbox_user_created` (`user_id`,`created_at`),
  KEY `idx_inbox_is_read` (`is_read`),
  KEY `idx_inbox_campaign` (`campaign_id`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` bigint(20) unsigned NOT NULL,
  `version` varchar(255) NOT NULL,
  `class` varchar(255) NOT NULL,
  `group` varchar(255) NOT NULL,
  `namespace` varchar(255) NOT NULL,
  `time` int(11) NOT NULL,
  `batch` int(11) unsigned NOT NULL,
  PRIMARY KEY (`id`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_codes` (
  `id` bigint(20) unsigned NOT NULL,
  `phone` varchar(20) NOT NULL,
  `purpose` varchar(24) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `attempts` smallint(5) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `phone` (`phone`,`purpose`,`created_at`),
  KEY `fk_otp_user` (`user_id`),
  CONSTRAINT `fk_otp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `people` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `note` text NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_people_user_rev` (`user_id`,`server_rev`),
  KEY `idx_people_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_people_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_campaigns` (
  `id` bigint(20) unsigned NOT NULL,
  `category` varchar(32) NOT NULL DEFAULT 'announcement',
  `title_en` varchar(150) NOT NULL,
  `title_bn` varchar(150) DEFAULT NULL,
  `body_en` text NOT NULL,
  `body_bn` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `logo_mode` varchar(16) NOT NULL DEFAULT 'none',
  `logo_url` varchar(255) DEFAULT NULL,
  `action_type` varchar(32) NOT NULL DEFAULT 'open_app',
  `action_value` varchar(255) DEFAULT NULL,
  `target` varchar(32) NOT NULL DEFAULT 'all',
  `target_filters` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `scheduled_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `sent_count` int(10) unsigned NOT NULL DEFAULT 0,
  `failed_count` int(10) unsigned NOT NULL DEFAULT 0,
  `opened_count` int(10) unsigned NOT NULL DEFAULT 0,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_status` (`status`),
  KEY `idx_campaigns_scheduled` (`scheduled_at`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_events` (
  `id` bigint(20) unsigned NOT NULL,
  `campaign_id` bigint(20) unsigned DEFAULT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `device_id` bigint(20) unsigned DEFAULT NULL,
  `opened_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_push_events_campaign` (`campaign_id`),
  KEY `idx_push_events_user` (`user_id`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `recurring_rules` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` varchar(20) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `currency` char(3) NOT NULL,
  `account_id` char(36) NOT NULL,
  `to_account_id` char(36) DEFAULT NULL,
  `category_id` char(36) DEFAULT NULL,
  `person_id` char(36) DEFAULT NULL,
  `note` text NOT NULL,
  `frequency` varchar(20) NOT NULL,
  `interval_step` int(11) NOT NULL DEFAULT 1,
  `by_day` varchar(60) DEFAULT NULL,
  `start_date` bigint(20) NOT NULL,
  `end_date` bigint(20) DEFAULT NULL,
  `max_count` int(11) DEFAULT NULL,
  `current_count` int(11) NOT NULL DEFAULT 0,
  `mode` varchar(20) NOT NULL DEFAULT 'remind',
  `next_run_at` bigint(20) NOT NULL,
  `is_subscription` tinyint(1) NOT NULL DEFAULT 0,
  `icon` varchar(60) DEFAULT NULL,
  `color` varchar(30) DEFAULT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recurring_user_rev` (`user_id`,`server_rev`),
  KEY `idx_recurring_book_next` (`book_id`,`next_run_at`),
  CONSTRAINT `fk_recurring_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_ticket_replies` (
  `id` bigint(20) unsigned NOT NULL,
  `ticket_id` bigint(20) unsigned NOT NULL,
  `sender_type` varchar(10) NOT NULL,
  `sender_id` bigint(20) unsigned DEFAULT NULL,
  `message` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_replies_ticket` (`ticket_id`),
  CONSTRAINT `fk_replies_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_tickets` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(120) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `subject` varchar(150) DEFAULT NULL,
  `message` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'new',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`,`created_at`),
  CONSTRAINT `fk_support_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `name` varchar(80) NOT NULL,
  `color` varchar(30) NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tags_user_rev` (`user_id`,`server_rev`),
  KEY `idx_tags_book_rev` (`book_id`,`server_rev`),
  CONSTRAINT `fk_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaction_tags` (
  `transaction_id` char(36) NOT NULL,
  `tag_id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `created_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`transaction_id`,`tag_id`),
  KEY `idx_tr_tags_user_rev` (`user_id`,`server_rev`),
  CONSTRAINT `fk_tr_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` char(36) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `book_id` char(36) NOT NULL,
  `type` varchar(30) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `currency` char(3) NOT NULL,
  `account_id` char(36) NOT NULL,
  `to_account_id` char(36) DEFAULT NULL,
  `fee` bigint(20) NOT NULL DEFAULT 0,
  `exchange_rate` decimal(16,6) DEFAULT NULL,
  `category_id` char(36) DEFAULT NULL,
  `occurred_at` bigint(20) NOT NULL,
  `note` text NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `recurring_rule_id` char(36) DEFAULT NULL,
  `goal_id` char(36) DEFAULT NULL,
  `asset_id` char(36) DEFAULT NULL,
  `created_at` bigint(20) NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `deleted_at` bigint(20) DEFAULT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_transactions_user_rev` (`user_id`,`server_rev`),
  KEY `idx_transactions_book_rev` (`book_id`,`server_rev`),
  KEY `idx_transactions_account` (`account_id`,`occurred_at`),
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_settings` (
  `user_id` bigint(20) unsigned NOT NULL,
  `settings_json` text NOT NULL,
  `updated_at` bigint(20) NOT NULL,
  `server_rev` bigint(20) NOT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_user_settings_rev` (`user_id`,`server_rev`),
  CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sync_revisions` (
  `user_id` bigint(20) unsigned NOT NULL,
  `current_rev` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_sync_rev_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL,
  `phone` varchar(20) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `occupation` varchar(120) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `country` char(2) NOT NULL DEFAULT 'BD',
  `currency` char(3) NOT NULL DEFAULT 'BDT',
  `language` char(2) NOT NULL DEFAULT 'en',
  `photo_path` varchar(255) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `status_reason` varchar(255) DEFAULT NULL,
  `status_until` datetime DEFAULT NULL,
  `last_seen_at` datetime DEFAULT NULL,
  `last_ip` varchar(45) DEFAULT NULL,
  `platform` varchar(20) DEFAULT NULL,
  `app_version` varchar(30) DEFAULT NULL,
  `marketing_push_opt_in` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `status` (`status`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

