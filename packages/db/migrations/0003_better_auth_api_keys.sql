-- Cal's ApiKey rows can't be read by Better Auth (and this app never wrote any), and RateLimit rows
-- only pointed at those keys. Existing installs bring keys over with the data import, which
-- converts Cal's hex digests.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ApiKey` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`configId` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`referenceId` text NOT NULL,
	`prefix` text,
	`key` text NOT NULL,
	`refillInterval` integer,
	`refillAmount` integer,
	`lastRefillAt` integer,
	`enabled` integer DEFAULT true,
	`rateLimitEnabled` integer DEFAULT true,
	`rateLimitTimeWindow` integer,
	`rateLimitMax` integer,
	`requestCount` integer DEFAULT 0,
	`remaining` integer,
	`lastRequest` integer,
	`expiresAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`permissions` text,
	`metadata` text
);
--> statement-breakpoint
DROP TABLE `ApiKey`;--> statement-breakpoint
ALTER TABLE `__new_ApiKey` RENAME TO `ApiKey`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `ApiKey_key_key` ON `ApiKey` (`key`);--> statement-breakpoint
CREATE INDEX `ApiKey_referenceId_idx` ON `ApiKey` (`referenceId`);--> statement-breakpoint
CREATE INDEX `ApiKey_configId_idx` ON `ApiKey` (`configId`);--> statement-breakpoint
CREATE TABLE `__new_RateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`apiKeyId` integer NOT NULL,
	`ttl` integer NOT NULL,
	`limit` integer NOT NULL,
	`blockDuration` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`apiKeyId`) REFERENCES `ApiKey`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `RateLimit`;--> statement-breakpoint
ALTER TABLE `__new_RateLimit` RENAME TO `RateLimit`;--> statement-breakpoint
CREATE INDEX `RateLimit_apiKeyId_idx` ON `RateLimit` (`apiKeyId`);--> statement-breakpoint
-- referenceId is text (Better Auth's type), so cascade from users by trigger instead of a foreign key.
CREATE TRIGGER `ApiKey_delete_with_user` AFTER DELETE ON `users`
BEGIN
  DELETE FROM `ApiKey` WHERE `referenceId` = CAST(OLD.`id` AS TEXT);
END;
