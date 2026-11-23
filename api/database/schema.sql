/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-12.3.2-MariaDB, for Linux (x86_64)
--
-- Host: localhost    Database: tohobil
-- ------------------------------------------------------
-- Server version	12.3.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `app_config`
--

DROP TABLE IF EXISTS `app_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_config` (
  `config_key` varchar(80) NOT NULL,
  `config_value` text NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `asset_valuations`
--

DROP TABLE IF EXISTS `asset_valuations`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assets`
--

DROP TABLE IF EXISTS `assets`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `event` varchar(80) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `details` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_tokens`
--

DROP TABLE IF EXISTS `auth_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocklist`
--

DROP TABLE IF EXISTS `blocklist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocklist` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(12) NOT NULL,
  `value` varchar(150) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `type` (`type`,`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `book_members`
--

DROP TABLE IF EXISTS `book_members`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `books`
--

DROP TABLE IF EXISTS `books`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `budgets`
--

DROP TABLE IF EXISTS `budgets`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `debt_entries`
--

DROP TABLE IF EXISTS `debt_entries`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `debt_installments`
--

DROP TABLE IF EXISTS `debt_installments`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `debts`
--

DROP TABLE IF EXISTS `debts`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `devices`
--

DROP TABLE IF EXISTS `devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `devices` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `exchange_rates`
--

DROP TABLE IF EXISTS `exchange_rates`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `factories`
--

DROP TABLE IF EXISTS `factories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `factories` (
  `id` int(9) NOT NULL AUTO_INCREMENT,
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `favorites`
--

DROP TABLE IF EXISTS `favorites`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `files`
--

DROP TABLE IF EXISTS `files`;
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
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_files_user` (`user_id`),
  KEY `idx_files_user_sha` (`user_id`,`sha256`),
  CONSTRAINT `fk_files_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `goals`
--

DROP TABLE IF EXISTS `goals`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `version` varchar(255) NOT NULL,
  `class` varchar(255) NOT NULL,
  `group` varchar(255) NOT NULL,
  `namespace` varchar(255) NOT NULL,
  `time` int(11) NOT NULL,
  `batch` int(11) unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `otp_codes`
--

DROP TABLE IF EXISTS `otp_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_codes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `people`
--

DROP TABLE IF EXISTS `people`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recurring_rules`
--

DROP TABLE IF EXISTS `recurring_rules`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `support_tickets`
--

DROP TABLE IF EXISTS `support_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_tickets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transaction_tags`
--

DROP TABLE IF EXISTS `transaction_tags`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_settings`
--

DROP TABLE IF EXISTS `user_settings`;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_sync_revisions`
--

DROP TABLE IF EXISTS `user_sync_revisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sync_revisions` (
  `user_id` bigint(20) unsigned NOT NULL,
  `current_rev` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_sync_rev_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
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
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-11-22 23:06:19
