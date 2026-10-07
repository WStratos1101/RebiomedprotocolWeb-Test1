ALTER TABLE `calculators` ADD `pendingEdit` json;--> statement-breakpoint
ALTER TABLE `calculators` ADD `pendingEditBy` int;--> statement-breakpoint
ALTER TABLE `calculators` ADD `pendingEditAt` timestamp;--> statement-breakpoint
ALTER TABLE `protocols` ADD `pendingEdit` json;--> statement-breakpoint
ALTER TABLE `protocols` ADD `pendingEditBy` int;--> statement-breakpoint
ALTER TABLE `protocols` ADD `pendingEditAt` timestamp;