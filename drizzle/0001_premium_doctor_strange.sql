CREATE TABLE `totp_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`issuer` varchar(128),
	`secret` varchar(256) NOT NULL,
	`icon` varchar(64),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `totp_accounts_id` PRIMARY KEY(`id`)
);
