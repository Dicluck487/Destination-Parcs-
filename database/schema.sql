-- Reference only. The site creates these tables itself on first start (prefix dp_ by default).
-- Use this file if you prefer to create the tables by hand in phpMyAdmin.
/*M!999999\- enable the sandbox mode */ 
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_admins` (
  `id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `username` varchar(60) NOT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `u_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_bookings` (
  `id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `ref` varchar(24) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `status` varchar(30) DEFAULT NULL,
  `check_in` date DEFAULT NULL,
  `nights` int(11) DEFAULT NULL,
  `stay_slug` varchar(80) DEFAULT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `u_ref` (`ref`),
  KEY `i_user_id` (`user_id`),
  KEY `i_status` (`status`),
  KEY `i_check_in` (`check_in`),
  KEY `i_stay_slug` (`stay_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_content` (
  `name` varchar(40) NOT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_content_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `file_key` varchar(80) NOT NULL,
  `name` varchar(40) NOT NULL,
  `note` varchar(400) DEFAULT NULL,
  `saved_at` datetime(3) DEFAULT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `u_file` (`file_key`),
  KEY `i_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_enquiries` (
  `id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `i_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_media` (
  `id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `kind` varchar(12) DEFAULT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `i_kind` (`kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_quotes` (
  `id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `i_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dp_users` (
  `id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `i_email` (`email`),
  KEY `i_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
