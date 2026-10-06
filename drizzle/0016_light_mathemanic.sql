ALTER TABLE `experimentLogs` ADD `templateName` varchar(160);--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `experimentName` varchar(255);--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `cellType` varchar(255);--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `chemicalsUsed` text;--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `cultureConditions` text;--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `startTime` varchar(32);--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `endTime` varchar(32);--> statement-breakpoint
ALTER TABLE `experimentLogs` ADD `result` text;