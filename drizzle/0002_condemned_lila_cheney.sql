CREATE TABLE `calculators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(80) NOT NULL,
	`formula` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`config` json NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `calculators_id` PRIMARY KEY(`id`),
	CONSTRAINT `calculators_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `experimentRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runCode` varchar(60) NOT NULL,
	`runDate` varchar(20) NOT NULL,
	`ctMean` decimal(8,3) NOT NULL,
	`efficiency` decimal(8,3) NOT NULL,
	`protocolSlug` varchar(120) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `experimentRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `experimentRuns_runCode_unique` UNIQUE(`runCode`)
);
--> statement-breakpoint
CREATE TABLE `protocols` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(80) NOT NULL,
	`tag` varchar(80) NOT NULL,
	`status` enum('Đã duyệt','Bản nháp') NOT NULL DEFAULT 'Bản nháp',
	`version` varchar(32) NOT NULL DEFAULT 'v0.1',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`owner` varchar(160) NOT NULL,
	`summary` text NOT NULL,
	`duration` varchar(80) NOT NULL,
	`steps` json NOT NULL,
	`notes` json NOT NULL,
	CONSTRAINT `protocols_id` PRIMARY KEY(`id`),
	CONSTRAINT `protocols_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `samples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`groupName` varchar(100) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'Bản nháp',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`description` text NOT NULL,
	`properties` json NOT NULL,
	`theory` text NOT NULL,
	CONSTRAINT `samples_id` PRIMARY KEY(`id`),
	CONSTRAINT `samples_code_unique` UNIQUE(`code`)
);
