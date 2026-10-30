ALTER TABLE `Session` ADD `impersonatedBy` integer REFERENCES users(id) ON UPDATE cascade ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `users` ADD `banReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banExpires` integer;