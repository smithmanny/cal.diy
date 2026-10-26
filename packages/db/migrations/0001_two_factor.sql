CREATE TABLE `TwoFactor` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`secret` text NOT NULL,
	`backupCodes` text NOT NULL,
	`verified` integer DEFAULT true NOT NULL,
	`failedVerificationCount` integer DEFAULT 0 NOT NULL,
	`lockedUntil` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TwoFactor_userId_idx` ON `TwoFactor` (`userId`);--> statement-breakpoint
CREATE INDEX `TwoFactor_secret_idx` ON `TwoFactor` (`secret`);