ALTER TABLE `users` ADD COLUMN `approvalStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved';
ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255) NULL;
