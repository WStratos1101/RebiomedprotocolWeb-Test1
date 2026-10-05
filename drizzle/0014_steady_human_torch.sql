CREATE TABLE `feedbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`category` varchar(32) NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`condition` varchar(80) NOT NULL,
	`remainingAmount` varchar(100),
	`remainingUnit` varchar(10),
	`usageCategory` varchar(255),
	`description` text,
	`resolvedById` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedbacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `note` text;--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `numericNote` text;--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `issue` text;