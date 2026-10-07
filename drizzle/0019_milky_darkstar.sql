ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','supporter','researcher','viewer','user') NOT NULL DEFAULT 'researcher';
UPDATE `users`
SET `username` = 'Supporter', `name` = 'Website Supporter', `email` = NULL, `role` = 'supporter', `approvalStatus` = 'approved'
WHERE LOWER(TRIM(COALESCE(`name`, ''))) = 'bao nguyen gia'
   OR LOWER(TRIM(COALESCE(`username`, ''))) = 'bao nguyen gia'
LIMIT 1;
