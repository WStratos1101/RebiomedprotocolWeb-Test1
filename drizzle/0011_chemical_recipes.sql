CREATE TABLE `chemicalRecipes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `slug` varchar(160) NOT NULL,
  `name` varchar(255) NOT NULL,
  `groupName` varchar(120) NOT NULL,
  `baseVolume` decimal(16,6) NOT NULL,
  `baseUnit` varchar(16) NOT NULL,
  `stock` varchar(255) NOT NULL,
  `note` text,
  `ingredients` json NOT NULL,
  `method` text NOT NULL,
  `active` int NOT NULL DEFAULT 1,
  CONSTRAINT `chemicalRecipes_id` PRIMARY KEY(`id`),
  CONSTRAINT `chemicalRecipes_slug_unique` UNIQUE(`slug`)
);
