CREATE TABLE `experimentLogs` (
`id` int AUTO_INCREMENT NOT NULL,
`ownerId` int NOT NULL,
`workDate` varchar(20) NOT NULL,
`workDone` text NOT NULL,
`protocol` text NOT NULL,
`cellsSeeded` varchar(255) NOT NULL,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `experimentLogs_id` PRIMARY KEY(`id`)
);
