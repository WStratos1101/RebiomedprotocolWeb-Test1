ALTER TABLE `users` ADD COLUMN `approvalStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved';
