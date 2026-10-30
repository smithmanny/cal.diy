-- Better Auth's organization plugin: invitations in their own table, and the active team per session.
ALTER TABLE `Session` ADD `activeOrganizationId` integer;--> statement-breakpoint
CREATE TABLE `TeamInvitation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`inviterId` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`inviterId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TeamInvitation_teamId_idx` ON `TeamInvitation` (`teamId`);--> statement-breakpoint
CREATE INDEX `TeamInvitation_email_idx` ON `TeamInvitation` (`email`);
