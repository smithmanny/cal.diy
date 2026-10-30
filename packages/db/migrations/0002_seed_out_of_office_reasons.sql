-- Cal's stock out-of-office reasons; `reason` is the translation key shown to users.
INSERT OR IGNORE INTO `OutOfOfficeReason` (`emoji`, `reason`, `enabled`) VALUES ('🕒', 'ooo_reasons_unspecified', 1);--> statement-breakpoint
INSERT OR IGNORE INTO `OutOfOfficeReason` (`emoji`, `reason`, `enabled`) VALUES ('🏝️', 'ooo_reasons_vacation', 1);--> statement-breakpoint
INSERT OR IGNORE INTO `OutOfOfficeReason` (`emoji`, `reason`, `enabled`) VALUES ('🛫', 'ooo_reasons_travel', 1);--> statement-breakpoint
INSERT OR IGNORE INTO `OutOfOfficeReason` (`emoji`, `reason`, `enabled`) VALUES ('🤒', 'ooo_reasons_sick_leave', 1);--> statement-breakpoint
INSERT OR IGNORE INTO `OutOfOfficeReason` (`emoji`, `reason`, `enabled`) VALUES ('📅', 'ooo_reasons_public_holiday', 1);
