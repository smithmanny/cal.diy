CREATE TABLE `AccessCode` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`clientId` text,
	`expiresAt` integer NOT NULL,
	`scopes` text NOT NULL,
	`userId` integer,
	`teamId` integer,
	`codeChallenge` text,
	`codeChallengeMethod` text DEFAULT 'S256',
	FOREIGN KEY (`clientId`) REFERENCES `OAuthClient`(`clientId`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AccessToken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`secret` text NOT NULL,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`platformOAuthClientId` text NOT NULL,
	`userId` integer NOT NULL,
	FOREIGN KEY (`platformOAuthClientId`) REFERENCES `PlatformOAuthClient`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AccessToken_secret_key` ON `AccessToken` (`secret`);--> statement-breakpoint
CREATE TABLE `Account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`providerEmail` text,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Account_userId_idx` ON `Account` (`userId`);--> statement-breakpoint
CREATE INDEX `Account_type_idx` ON `Account` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `Account_provider_providerAccountId_key` ON `Account` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE TABLE `Agent` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`userId` integer,
	`teamId` integer,
	`providerAgentId` text NOT NULL,
	`inboundEventTypeId` integer,
	`outboundEventTypeId` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Agent_providerAgentId_key` ON `Agent` (`providerAgentId`);--> statement-breakpoint
CREATE INDEX `Agent_userId_idx` ON `Agent` (`userId`);--> statement-breakpoint
CREATE INDEX `Agent_teamId_idx` ON `Agent` (`teamId`);--> statement-breakpoint
CREATE INDEX `Agent_inboundEventTypeId_idx` ON `Agent` (`inboundEventTypeId`);--> statement-breakpoint
CREATE INDEX `Agent_outboundEventTypeId_idx` ON `Agent` (`outboundEventTypeId`);--> statement-breakpoint
CREATE TABLE `ApiKey` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`teamId` integer,
	`note` text,
	`createdAt` integer NOT NULL,
	`expiresAt` integer,
	`lastUsedAt` integer,
	`hashedKey` text NOT NULL,
	`appId` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`appId`) REFERENCES `App`(`slug`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ApiKey_hashedKey_key` ON `ApiKey` (`hashedKey`);--> statement-breakpoint
CREATE INDEX `ApiKey_userId_idx` ON `ApiKey` (`userId`);--> statement-breakpoint
CREATE TABLE `App` (
	`slug` text PRIMARY KEY NOT NULL,
	`dirName` text NOT NULL,
	`keys` text,
	`categories` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `App_dirName_key` ON `App` (`dirName`);--> statement-breakpoint
CREATE INDEX `App_enabled_idx` ON `App` (`enabled`);--> statement-breakpoint
CREATE TABLE `AssignmentReason` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`createdAt` integer NOT NULL,
	`bookingId` integer NOT NULL,
	`reasonEnum` text NOT NULL,
	`reasonString` text NOT NULL,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `AssignmentReason_bookingId_idx` ON `AssignmentReason` (`bookingId`);--> statement-breakpoint
CREATE TABLE `Attendee` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`timeZone` text NOT NULL,
	`phoneNumber` text,
	`locale` text DEFAULT 'en',
	`bookingId` integer,
	`noShow` integer DEFAULT false,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Attendee_email_idx` ON `Attendee` (`email`);--> statement-breakpoint
CREATE INDEX `Attendee_bookingId_idx` ON `Attendee` (`bookingId`);--> statement-breakpoint
CREATE INDEX `Attendee_email_bookingId_idx` ON `Attendee` (`email`,`bookingId`);--> statement-breakpoint
CREATE TABLE `Attribute` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`usersCanEditRelation` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`isWeightsEnabled` integer DEFAULT false NOT NULL,
	`isLocked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Attribute_teamId_idx` ON `Attribute` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Attribute_teamId_slug_key` ON `Attribute` (`teamId`,`slug`);--> statement-breakpoint
CREATE TABLE `AttributeOption` (
	`id` text PRIMARY KEY NOT NULL,
	`attributeId` text NOT NULL,
	`value` text NOT NULL,
	`slug` text NOT NULL,
	`isGroup` integer DEFAULT false NOT NULL,
	`contains` text NOT NULL,
	FOREIGN KEY (`attributeId`) REFERENCES `Attribute`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AttributeSyncFieldMapping` (
	`id` text PRIMARY KEY NOT NULL,
	`integrationFieldName` text NOT NULL,
	`attributeId` text NOT NULL,
	`enabled` integer NOT NULL,
	`integrationAttributeSyncId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`attributeId`) REFERENCES `Attribute`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`integrationAttributeSyncId`) REFERENCES `IntegrationAttributeSync`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `AttributeSyncFieldMapping_integrationAttributeSyncId_idx` ON `AttributeSyncFieldMapping` (`integrationAttributeSyncId`);--> statement-breakpoint
CREATE UNIQUE INDEX `AttributeSyncFieldMapping_integrationAttributeSyncId_attributeId_key` ON `AttributeSyncFieldMapping` (`integrationAttributeSyncId`,`attributeId`);--> statement-breakpoint
CREATE TABLE `AttributeSyncRule` (
	`id` text PRIMARY KEY NOT NULL,
	`integrationAttributeSyncId` text NOT NULL,
	`rule` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`integrationAttributeSyncId`) REFERENCES `IntegrationAttributeSync`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AttributeSyncRule_integrationAttributeSyncId_key` ON `AttributeSyncRule` (`integrationAttributeSyncId`);--> statement-breakpoint
CREATE TABLE `AttributeToUser` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` integer NOT NULL,
	`attributeOptionId` text NOT NULL,
	`weight` integer,
	`createdAt` integer NOT NULL,
	`createdById` integer,
	`createdByDSyncId` text,
	`updatedAt` integer,
	`updatedById` integer,
	`updatedByDSyncId` text,
	FOREIGN KEY (`memberId`) REFERENCES `Membership`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attributeOptionId`) REFERENCES `AttributeOption`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`createdByDSyncId`) REFERENCES `DSyncData`(`directoryId`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`updatedByDSyncId`) REFERENCES `DSyncData`(`directoryId`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AttributeToUser_memberId_attributeOptionId_key` ON `AttributeToUser` (`memberId`,`attributeOptionId`);--> statement-breakpoint
CREATE TABLE `AuditActor` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`userUuid` text,
	`attendeeId` integer,
	`credentialId` integer,
	`email` text,
	`phone` text,
	`name` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AuditActor_userUuid_key` ON `AuditActor` (`userUuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `AuditActor_attendeeId_key` ON `AuditActor` (`attendeeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `AuditActor_credentialId_key` ON `AuditActor` (`credentialId`);--> statement-breakpoint
CREATE UNIQUE INDEX `AuditActor_email_key` ON `AuditActor` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `AuditActor_phone_key` ON `AuditActor` (`phone`);--> statement-breakpoint
CREATE INDEX `AuditActor_email_idx` ON `AuditActor` (`email`);--> statement-breakpoint
CREATE INDEX `AuditActor_userUuid_idx` ON `AuditActor` (`userUuid`);--> statement-breakpoint
CREATE INDEX `AuditActor_attendeeId_idx` ON `AuditActor` (`attendeeId`);--> statement-breakpoint
CREATE INDEX `AuditActor_credentialId_idx` ON `AuditActor` (`credentialId`);--> statement-breakpoint
CREATE TABLE `Availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`eventTypeId` integer,
	`days` text NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`date` integer,
	`scheduleId` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`scheduleId`) REFERENCES `Schedule`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Availability_userId_idx` ON `Availability` (`userId`);--> statement-breakpoint
CREATE INDEX `Availability_eventTypeId_idx` ON `Availability` (`eventTypeId`);--> statement-breakpoint
CREATE INDEX `Availability_scheduleId_idx` ON `Availability` (`scheduleId`);--> statement-breakpoint
CREATE TABLE `avatars` (
	`teamId` integer DEFAULT 0 NOT NULL,
	`userId` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`objectKey` text NOT NULL,
	`isBanner` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avatars_objectKey_key` ON `avatars` (`objectKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `avatars_teamId_userId_isBanner_key` ON `avatars` (`teamId`,`userId`,`isBanner`);--> statement-breakpoint
CREATE TABLE `Booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`idempotencyKey` text,
	`userId` integer,
	`userPrimaryEmail` text,
	`eventTypeId` integer,
	`title` text NOT NULL,
	`description` text,
	`customInputs` text,
	`responses` text,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`location` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	`status` text DEFAULT 'ACCEPTED' NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`destinationCalendarId` integer,
	`cancellationReason` text,
	`rejectionReason` text,
	`reassignReason` text,
	`reassignById` integer,
	`dynamicEventSlugRef` text,
	`dynamicGroupSlugRef` text,
	`rescheduled` integer,
	`fromReschedule` text,
	`recurringEventId` text,
	`smsReminderNumber` text,
	`scheduledJobs` text NOT NULL,
	`metadata` text,
	`isRecorded` integer DEFAULT false NOT NULL,
	`iCalUID` text DEFAULT '',
	`iCalSequence` integer DEFAULT 0 NOT NULL,
	`rating` integer,
	`ratingFeedback` text,
	`noShowHost` integer DEFAULT false,
	`oneTimePassword` text,
	`cancelledBy` text,
	`rescheduledBy` text,
	`creationSource` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`destinationCalendarId`) REFERENCES `DestinationCalendar`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`reassignById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Booking_uid_key` ON `Booking` (`uid`);--> statement-breakpoint
CREATE UNIQUE INDEX `Booking_idempotencyKey_key` ON `Booking` (`idempotencyKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `Booking_oneTimePassword_key` ON `Booking` (`oneTimePassword`);--> statement-breakpoint
CREATE INDEX `Booking_eventTypeId_idx` ON `Booking` (`eventTypeId`);--> statement-breakpoint
CREATE INDEX `Booking_userId_idx` ON `Booking` (`userId`);--> statement-breakpoint
CREATE INDEX `Booking_destinationCalendarId_idx` ON `Booking` (`destinationCalendarId`);--> statement-breakpoint
CREATE INDEX `Booking_recurringEventId_idx` ON `Booking` (`recurringEventId`);--> statement-breakpoint
CREATE INDEX `Booking_uid_idx` ON `Booking` (`uid`);--> statement-breakpoint
CREATE INDEX `Booking_status_idx` ON `Booking` (`status`);--> statement-breakpoint
CREATE INDEX `Booking_startTime_endTime_status_idx` ON `Booking` (`startTime`,`endTime`,`status`);--> statement-breakpoint
CREATE INDEX `Booking_fromReschedule_idx` ON `Booking` (`fromReschedule`);--> statement-breakpoint
CREATE INDEX `Booking_userId_endTime_idx` ON `Booking` (`userId`,`endTime`);--> statement-breakpoint
CREATE INDEX `Booking_userId_status_startTime_idx` ON `Booking` (`userId`,`status`,`startTime`);--> statement-breakpoint
CREATE INDEX `Booking_eventTypeId_status_idx` ON `Booking` (`eventTypeId`,`status`);--> statement-breakpoint
CREATE INDEX `Booking_userId_createdAt_idx` ON `Booking` (`userId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `BookingAudit` (
	`id` text PRIMARY KEY NOT NULL,
	`bookingUid` text NOT NULL,
	`actorId` text NOT NULL,
	`type` text NOT NULL,
	`action` text NOT NULL,
	`timestamp` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`source` text NOT NULL,
	`operationId` text NOT NULL,
	`data` text,
	`context` text,
	FOREIGN KEY (`actorId`) REFERENCES `AuditActor`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `BookingAudit_actorId_idx` ON `BookingAudit` (`actorId`);--> statement-breakpoint
CREATE INDEX `BookingAudit_bookingUid_idx` ON `BookingAudit` (`bookingUid`);--> statement-breakpoint
CREATE INDEX `BookingAudit_timestamp_idx` ON `BookingAudit` (`timestamp`);--> statement-breakpoint
CREATE INDEX `BookingAudit_operationId_idx` ON `BookingAudit` (`operationId`);--> statement-breakpoint
CREATE TABLE `BookingDenormalized` (
	`id` integer PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`eventTypeId` integer,
	`title` text NOT NULL,
	`description` text,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	`location` text,
	`paid` integer NOT NULL,
	`status` text NOT NULL,
	`rescheduled` integer,
	`userId` integer,
	`teamId` integer,
	`eventLength` integer,
	`eventParentId` integer,
	`userEmail` text,
	`userName` text,
	`userUsername` text,
	`ratingFeedback` text,
	`rating` integer,
	`noShowHost` integer,
	`isTeamBooking` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `BookingDenormalized_userId_idx` ON `BookingDenormalized` (`userId`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_createdAt_idx` ON `BookingDenormalized` (`createdAt`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_eventTypeId_idx` ON `BookingDenormalized` (`eventTypeId`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_eventParentId_idx` ON `BookingDenormalized` (`eventParentId`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_teamId_idx` ON `BookingDenormalized` (`teamId`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_startTime_idx` ON `BookingDenormalized` (`startTime`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_endTime_idx` ON `BookingDenormalized` (`endTime`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_status_idx` ON `BookingDenormalized` (`status`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_teamId_isTeamBooking_idx` ON `BookingDenormalized` (`teamId`,`isTeamBooking`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_userId_isTeamBooking_idx` ON `BookingDenormalized` (`userId`,`isTeamBooking`);--> statement-breakpoint
CREATE INDEX `BookingDenormalized_startTime_endTime_idx` ON `BookingDenormalized` (`startTime`,`endTime`);--> statement-breakpoint
CREATE TABLE `BookingInternalNote` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notePresetId` integer,
	`text` text,
	`bookingId` integer NOT NULL,
	`createdById` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`notePresetId`) REFERENCES `InternalNotePreset`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `BookingInternalNote_bookingId_idx` ON `BookingInternalNote` (`bookingId`);--> statement-breakpoint
CREATE UNIQUE INDEX `BookingInternalNote_bookingId_notePresetId_key` ON `BookingInternalNote` (`bookingId`,`notePresetId`);--> statement-breakpoint
CREATE TABLE `BookingReference` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`uid` text NOT NULL,
	`meetingId` text,
	`thirdPartyRecurringEventId` text,
	`meetingPassword` text,
	`meetingUrl` text,
	`bookingId` integer,
	`externalCalendarId` text,
	`deleted` integer,
	`credentialId` integer,
	`delegationCredentialId` text,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`credentialId`) REFERENCES `Credential`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`delegationCredentialId`) REFERENCES `DelegationCredential`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `BookingReference_bookingId_idx` ON `BookingReference` (`bookingId`);--> statement-breakpoint
CREATE INDEX `BookingReference_type_idx` ON `BookingReference` (`type`);--> statement-breakpoint
CREATE INDEX `BookingReference_uid_idx` ON `BookingReference` (`uid`);--> statement-breakpoint
CREATE TABLE `BookingReport` (
	`id` text PRIMARY KEY NOT NULL,
	`bookingUid` text NOT NULL,
	`bookerEmail` text NOT NULL,
	`reportedById` integer,
	`organizationId` integer,
	`reason` text NOT NULL,
	`description` text,
	`cancelled` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`systemStatus` text DEFAULT 'PENDING' NOT NULL,
	`watchlistId` text,
	`globalWatchlistId` text,
	FOREIGN KEY (`bookingUid`) REFERENCES `Booking`(`uid`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`reportedById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`watchlistId`) REFERENCES `Watchlist`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`globalWatchlistId`) REFERENCES `Watchlist`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `BookingReport_bookingUid_key` ON `BookingReport` (`bookingUid`);--> statement-breakpoint
CREATE INDEX `BookingReport_bookerEmail_idx` ON `BookingReport` (`bookerEmail`);--> statement-breakpoint
CREATE INDEX `BookingReport_reportedById_idx` ON `BookingReport` (`reportedById`);--> statement-breakpoint
CREATE INDEX `BookingReport_organizationId_idx` ON `BookingReport` (`organizationId`);--> statement-breakpoint
CREATE INDEX `BookingReport_watchlistId_idx` ON `BookingReport` (`watchlistId`);--> statement-breakpoint
CREATE INDEX `BookingReport_globalWatchlistId_idx` ON `BookingReport` (`globalWatchlistId`);--> statement-breakpoint
CREATE INDEX `BookingReport_systemStatus_idx` ON `BookingReport` (`systemStatus`);--> statement-breakpoint
CREATE INDEX `BookingReport_createdAt_idx` ON `BookingReport` (`createdAt`);--> statement-breakpoint
CREATE TABLE `BookingSeat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`referenceUid` text NOT NULL,
	`bookingId` integer NOT NULL,
	`attendeeId` integer NOT NULL,
	`data` text,
	`metadata` text,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`attendeeId`) REFERENCES `Attendee`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `BookingSeat_referenceUid_key` ON `BookingSeat` (`referenceUid`);--> statement-breakpoint
CREATE UNIQUE INDEX `BookingSeat_attendeeId_key` ON `BookingSeat` (`attendeeId`);--> statement-breakpoint
CREATE INDEX `BookingSeat_bookingId_idx` ON `BookingSeat` (`bookingId`);--> statement-breakpoint
CREATE INDEX `BookingSeat_attendeeId_idx` ON `BookingSeat` (`attendeeId`);--> statement-breakpoint
CREATE TABLE `CalAiPhoneNumber` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`teamId` integer,
	`phoneNumber` text NOT NULL,
	`provider` text NOT NULL,
	`providerPhoneNumberId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`stripeCustomerId` text,
	`stripeSubscriptionId` text,
	`subscriptionStatus` text,
	`inboundAgentId` text,
	`outboundAgentId` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`inboundAgentId`) REFERENCES `Agent`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`outboundAgentId`) REFERENCES `Agent`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CalAiPhoneNumber_phoneNumber_key` ON `CalAiPhoneNumber` (`phoneNumber`);--> statement-breakpoint
CREATE UNIQUE INDEX `CalAiPhoneNumber_providerPhoneNumberId_key` ON `CalAiPhoneNumber` (`providerPhoneNumberId`);--> statement-breakpoint
CREATE UNIQUE INDEX `CalAiPhoneNumber_stripeSubscriptionId_key` ON `CalAiPhoneNumber` (`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `CalAiPhoneNumber_userId_idx` ON `CalAiPhoneNumber` (`userId`);--> statement-breakpoint
CREATE INDEX `CalAiPhoneNumber_teamId_idx` ON `CalAiPhoneNumber` (`teamId`);--> statement-breakpoint
CREATE INDEX `CalAiPhoneNumber_inboundAgentId_idx` ON `CalAiPhoneNumber` (`inboundAgentId`);--> statement-breakpoint
CREATE INDEX `CalAiPhoneNumber_outboundAgentId_idx` ON `CalAiPhoneNumber` (`outboundAgentId`);--> statement-breakpoint
CREATE TABLE `CalVideoSettings` (
	`eventTypeId` integer PRIMARY KEY NOT NULL,
	`disableRecordingForOrganizer` integer DEFAULT false NOT NULL,
	`disableRecordingForGuests` integer DEFAULT false NOT NULL,
	`enableAutomaticTranscription` integer DEFAULT false NOT NULL,
	`enableAutomaticRecordingForOrganizer` integer DEFAULT false NOT NULL,
	`redirectUrlOnExit` text,
	`disableTranscriptionForGuests` integer DEFAULT false NOT NULL,
	`disableTranscriptionForOrganizer` integer DEFAULT false NOT NULL,
	`requireEmailForGuests` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `CalendarCache` (
	`id` text,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`credentialId` integer NOT NULL,
	`userId` integer,
	PRIMARY KEY(`credentialId`, `key`),
	FOREIGN KEY (`credentialId`) REFERENCES `Credential`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CalendarCache_userId_key_idx` ON `CalendarCache` (`userId`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `CalendarCache_credentialId_key_key` ON `CalendarCache` (`credentialId`,`key`);--> statement-breakpoint
CREATE TABLE `CalendarCacheEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`selectedCalendarId` text NOT NULL,
	`externalId` text NOT NULL,
	`externalEtag` text NOT NULL,
	`iCalUID` text,
	`iCalSequence` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`description` text,
	`location` text,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`isAllDay` integer DEFAULT false NOT NULL,
	`timeZone` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`recurringEventId` text,
	`originalStartTime` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`externalCreatedAt` integer,
	`externalUpdatedAt` integer,
	FOREIGN KEY (`selectedCalendarId`) REFERENCES `SelectedCalendar`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CalendarCacheEvent_start_end_status_idx` ON `CalendarCacheEvent` (`start`,`end`,`status`);--> statement-breakpoint
CREATE INDEX `CalendarCacheEvent_selectedCalendarId_iCalUID_idx` ON `CalendarCacheEvent` (`selectedCalendarId`,`iCalUID`);--> statement-breakpoint
CREATE UNIQUE INDEX `CalendarCacheEvent_selectedCalendarId_externalId_key` ON `CalendarCacheEvent` (`selectedCalendarId`,`externalId`);--> statement-breakpoint
CREATE TABLE `Credential` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`encryptedKey` text,
	`userId` integer,
	`teamId` integer,
	`appId` text,
	`subscriptionId` text,
	`paymentStatus` text,
	`billingCycleStart` integer,
	`invalid` integer DEFAULT false,
	`delegationCredentialId` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`appId`) REFERENCES `App`(`slug`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`delegationCredentialId`) REFERENCES `DelegationCredential`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Credential_appId_idx` ON `Credential` (`appId`);--> statement-breakpoint
CREATE INDEX `Credential_subscriptionId_idx` ON `Credential` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `Credential_invalid_idx` ON `Credential` (`invalid`);--> statement-breakpoint
CREATE INDEX `Credential_userId_delegationCredentialId_idx` ON `Credential` (`userId`,`delegationCredentialId`);--> statement-breakpoint
CREATE INDEX `Credential_teamId_idx` ON `Credential` (`teamId`);--> statement-breakpoint
CREATE TABLE `CreditBalance` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` integer,
	`userId` integer,
	`additionalCredits` integer DEFAULT 0 NOT NULL,
	`limitReachedAt` integer,
	`warningSentAt` integer,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CreditBalance_teamId_key` ON `CreditBalance` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `CreditBalance_userId_key` ON `CreditBalance` (`userId`);--> statement-breakpoint
CREATE TABLE `CreditExpenseLog` (
	`id` text PRIMARY KEY NOT NULL,
	`creditBalanceId` text NOT NULL,
	`bookingUid` text,
	`credits` integer,
	`creditType` text NOT NULL,
	`date` integer NOT NULL,
	`smsSid` text,
	`smsSegments` integer,
	`phoneNumber` text,
	`email` text,
	`callDuration` integer,
	`creditFor` text,
	`externalRef` text,
	FOREIGN KEY (`creditBalanceId`) REFERENCES `CreditBalance`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`bookingUid`) REFERENCES `Booking`(`uid`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CreditExpenseLog_externalRef_key` ON `CreditExpenseLog` (`externalRef`);--> statement-breakpoint
CREATE TABLE `CreditPurchaseLog` (
	`id` text PRIMARY KEY NOT NULL,
	`creditBalanceId` text NOT NULL,
	`credits` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`creditBalanceId`) REFERENCES `CreditBalance`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `DSyncData` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`directoryId` text NOT NULL,
	`tenant` text NOT NULL,
	`organizationId` integer,
	FOREIGN KEY (`organizationId`) REFERENCES `OrganizationSettings`(`organizationId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DSyncData_directoryId_key` ON `DSyncData` (`directoryId`);--> statement-breakpoint
CREATE UNIQUE INDEX `DSyncData_organizationId_key` ON `DSyncData` (`organizationId`);--> statement-breakpoint
CREATE TABLE `DSyncTeamGroupMapping` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` integer NOT NULL,
	`teamId` integer NOT NULL,
	`directoryId` text NOT NULL,
	`groupName` text NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`directoryId`) REFERENCES `DSyncData`(`directoryId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DSyncTeamGroupMapping_teamId_groupName_key` ON `DSyncTeamGroupMapping` (`teamId`,`groupName`);--> statement-breakpoint
CREATE TABLE `DelegationCredential` (
	`id` text PRIMARY KEY NOT NULL,
	`workspacePlatformId` integer NOT NULL,
	`serviceAccountKey` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`lastEnabledAt` integer,
	`lastDisabledAt` integer,
	`organizationId` integer NOT NULL,
	`domain` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`workspacePlatformId`) REFERENCES `WorkspacePlatform`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `DelegationCredential_enabled_idx` ON `DelegationCredential` (`enabled`);--> statement-breakpoint
CREATE UNIQUE INDEX `DelegationCredential_organizationId_domain_key` ON `DelegationCredential` (`organizationId`,`domain`);--> statement-breakpoint
CREATE TABLE `Deployment` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`logo` text,
	`theme` text,
	`licenseKey` text,
	`signatureTokenEncrypted` text,
	`agreedLicenseAt` integer
);
--> statement-breakpoint
CREATE TABLE `DestinationCalendar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`integration` text NOT NULL,
	`externalId` text NOT NULL,
	`primaryEmail` text,
	`userId` integer,
	`eventTypeId` integer,
	`credentialId` integer,
	`createdAt` integer,
	`updatedAt` integer,
	`delegationCredentialId` text,
	`customCalendarReminder` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`credentialId`) REFERENCES `Credential`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`delegationCredentialId`) REFERENCES `DelegationCredential`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DestinationCalendar_userId_key` ON `DestinationCalendar` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `DestinationCalendar_eventTypeId_key` ON `DestinationCalendar` (`eventTypeId`);--> statement-breakpoint
CREATE INDEX `DestinationCalendar_userId_idx` ON `DestinationCalendar` (`userId`);--> statement-breakpoint
CREATE INDEX `DestinationCalendar_eventTypeId_idx` ON `DestinationCalendar` (`eventTypeId`);--> statement-breakpoint
CREATE INDEX `DestinationCalendar_credentialId_idx` ON `DestinationCalendar` (`credentialId`);--> statement-breakpoint
CREATE TABLE `EventType` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`interfaceLanguage` text,
	`position` integer DEFAULT 0 NOT NULL,
	`locations` text,
	`length` integer NOT NULL,
	`offsetStart` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`userId` integer,
	`profileId` integer,
	`teamId` integer,
	`useEventLevelSelectedCalendars` integer DEFAULT false NOT NULL,
	`eventName` text,
	`parentId` integer,
	`bookingFields` text,
	`timeZone` text,
	`periodType` text DEFAULT 'UNLIMITED' NOT NULL,
	`periodStartDate` integer,
	`periodEndDate` integer,
	`periodDays` integer,
	`periodCountCalendarDays` integer,
	`lockTimeZoneToggleOnBookingPage` integer DEFAULT false NOT NULL,
	`lockedTimeZone` text,
	`requiresConfirmation` integer DEFAULT false NOT NULL,
	`requiresConfirmationWillBlockSlot` integer DEFAULT false NOT NULL,
	`requiresConfirmationForFreeEmail` integer DEFAULT false NOT NULL,
	`requiresBookerEmailVerification` integer DEFAULT false NOT NULL,
	`canSendCalVideoTranscriptionEmails` integer DEFAULT true NOT NULL,
	`autoTranslateDescriptionEnabled` integer DEFAULT false NOT NULL,
	`autoTranslateInstantMeetingTitleEnabled` integer DEFAULT true NOT NULL,
	`recurringEvent` text,
	`disableGuests` integer DEFAULT false NOT NULL,
	`hideCalendarNotes` integer DEFAULT false NOT NULL,
	`hideCalendarEventDetails` integer DEFAULT false NOT NULL,
	`minimumBookingNotice` integer DEFAULT 120 NOT NULL,
	`beforeEventBuffer` integer DEFAULT 0 NOT NULL,
	`afterEventBuffer` integer DEFAULT 0 NOT NULL,
	`seatsPerTimeSlot` integer,
	`onlyShowFirstAvailableSlot` integer DEFAULT false NOT NULL,
	`showOptimizedSlots` integer DEFAULT false,
	`disableCancelling` integer DEFAULT false,
	`disableRescheduling` integer DEFAULT false,
	`minimumRescheduleNotice` integer,
	`seatsShowAttendees` integer DEFAULT false,
	`seatsShowAvailabilityCount` integer DEFAULT true,
	`schedulingType` text,
	`scheduleId` integer,
	`allowReschedulingCancelledBookings` integer DEFAULT false,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`slotInterval` integer,
	`metadata` text,
	`successRedirectUrl` text,
	`forwardParamsSuccessRedirect` integer DEFAULT true,
	`bookingLimits` text,
	`durationLimits` text,
	`isInstantEvent` integer DEFAULT false NOT NULL,
	`instantMeetingExpiryTimeOffsetInSeconds` integer DEFAULT 90 NOT NULL,
	`instantMeetingScheduleId` integer,
	`instantMeetingParameters` text NOT NULL,
	`assignAllTeamMembers` integer DEFAULT false NOT NULL,
	`assignRRMembersUsingSegment` integer DEFAULT false NOT NULL,
	`rrSegmentQueryValue` text,
	`useEventTypeDestinationCalendarEmail` integer DEFAULT false NOT NULL,
	`isRRWeightsEnabled` integer DEFAULT false NOT NULL,
	`maxLeadThreshold` integer,
	`includeNoShowInRRCalculation` integer DEFAULT false NOT NULL,
	`allowReschedulingPastBookings` integer DEFAULT false NOT NULL,
	`hideOrganizerEmail` integer DEFAULT false NOT NULL,
	`maxActiveBookingsPerBooker` integer,
	`maxActiveBookingPerBookerOfferReschedule` integer DEFAULT false NOT NULL,
	`customReplyToEmail` text,
	`eventTypeColor` text,
	`rescheduleWithSameRoundRobinHost` integer DEFAULT false NOT NULL,
	`secondaryEmailId` integer,
	`useBookerTimezone` integer DEFAULT false NOT NULL,
	`restrictionScheduleId` integer,
	`bookingRequiresAuthentication` integer DEFAULT false NOT NULL,
	`rrHostSubsetEnabled` integer DEFAULT false NOT NULL,
	`requiresCancellationReason` text DEFAULT 'MANDATORY_HOST_ONLY',
	`enablePerHostLocations` integer DEFAULT false NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`parentId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`scheduleId`) REFERENCES `Schedule`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`instantMeetingScheduleId`) REFERENCES `Schedule`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`secondaryEmailId`) REFERENCES `SecondaryEmail`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`restrictionScheduleId`) REFERENCES `Schedule`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `EventType_userId_idx` ON `EventType` (`userId`);--> statement-breakpoint
CREATE INDEX `EventType_teamId_idx` ON `EventType` (`teamId`);--> statement-breakpoint
CREATE INDEX `EventType_profileId_idx` ON `EventType` (`profileId`);--> statement-breakpoint
CREATE INDEX `EventType_scheduleId_idx` ON `EventType` (`scheduleId`);--> statement-breakpoint
CREATE INDEX `EventType_secondaryEmailId_idx` ON `EventType` (`secondaryEmailId`);--> statement-breakpoint
CREATE INDEX `EventType_parentId_idx` ON `EventType` (`parentId`);--> statement-breakpoint
CREATE INDEX `EventType_parentId_teamId_idx` ON `EventType` (`parentId`,`teamId`);--> statement-breakpoint
CREATE INDEX `EventType_restrictionScheduleId_idx` ON `EventType` (`restrictionScheduleId`);--> statement-breakpoint
CREATE UNIQUE INDEX `EventType_userId_slug_key` ON `EventType` (`userId`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `EventType_teamId_slug_key` ON `EventType` (`teamId`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `EventType_userId_parentId_key` ON `EventType` (`userId`,`parentId`);--> statement-breakpoint
CREATE TABLE `EventTypeCustomInput` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventTypeId` integer NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`options` text,
	`required` integer NOT NULL,
	`placeholder` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `EventTypeCustomInput_eventTypeId_idx` ON `EventTypeCustomInput` (`eventTypeId`);--> statement-breakpoint
CREATE TABLE `EventTypeTranslation` (
	`uid` text PRIMARY KEY NOT NULL,
	`eventTypeId` integer NOT NULL,
	`field` text NOT NULL,
	`sourceLocale` text NOT NULL,
	`targetLocale` text NOT NULL,
	`translatedText` text NOT NULL,
	`createdAt` integer NOT NULL,
	`createdBy` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`updatedBy` integer,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `EventTypeTranslation_eventTypeId_field_targetLocale_idx` ON `EventTypeTranslation` (`eventTypeId`,`field`,`targetLocale`);--> statement-breakpoint
CREATE UNIQUE INDEX `EventTypeTranslation_eventTypeId_field_targetLocale_key` ON `EventTypeTranslation` (`eventTypeId`,`field`,`targetLocale`);--> statement-breakpoint
CREATE TABLE `Feature` (
	`slug` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text,
	`type` text DEFAULT 'RELEASE',
	`stale` integer DEFAULT false,
	`lastUsedAt` integer,
	`createdAt` integer,
	`updatedAt` integer,
	`updatedBy` integer
);
--> statement-breakpoint
CREATE INDEX `Feature_enabled_idx` ON `Feature` (`enabled`);--> statement-breakpoint
CREATE INDEX `Feature_stale_idx` ON `Feature` (`stale`);--> statement-breakpoint
CREATE TABLE `Feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`userId` integer NOT NULL,
	`rating` text NOT NULL,
	`comment` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Feedback_userId_idx` ON `Feedback` (`userId`);--> statement-breakpoint
CREATE INDEX `Feedback_rating_idx` ON `Feedback` (`rating`);--> statement-breakpoint
CREATE TABLE `FilterSegment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`tableIdentifier` text NOT NULL,
	`scope` text NOT NULL,
	`activeFilters` text,
	`sorting` text,
	`columnVisibility` text,
	`columnSizing` text,
	`perPage` integer NOT NULL,
	`searchTerm` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`userId` integer NOT NULL,
	`teamId` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FilterSegment_scope_userId_tableIdentifier_idx` ON `FilterSegment` (`scope`,`userId`,`tableIdentifier`);--> statement-breakpoint
CREATE INDEX `FilterSegment_scope_teamId_tableIdentifier_idx` ON `FilterSegment` (`scope`,`teamId`,`tableIdentifier`);--> statement-breakpoint
CREATE TABLE `HashedLink` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link` text NOT NULL,
	`eventTypeId` integer NOT NULL,
	`expiresAt` integer,
	`maxUsageCount` integer DEFAULT 1 NOT NULL,
	`usageCount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `HashedLink_link_key` ON `HashedLink` (`link`);--> statement-breakpoint
CREATE INDEX `HashedLink_eventTypeId_idx` ON `HashedLink` (`eventTypeId`);--> statement-breakpoint
CREATE TABLE `HolidayCache` (
	`id` text PRIMARY KEY NOT NULL,
	`countryCode` text NOT NULL,
	`calendarId` text NOT NULL,
	`eventId` text NOT NULL,
	`name` text NOT NULL,
	`date` integer NOT NULL,
	`year` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `HolidayCache_countryCode_year_idx` ON `HolidayCache` (`countryCode`,`year`);--> statement-breakpoint
CREATE INDEX `HolidayCache_countryCode_date_idx` ON `HolidayCache` (`countryCode`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `HolidayCache_countryCode_eventId_key` ON `HolidayCache` (`countryCode`,`eventId`);--> statement-breakpoint
CREATE TABLE `Host` (
	`userId` integer NOT NULL,
	`eventTypeId` integer NOT NULL,
	`isFixed` integer DEFAULT false NOT NULL,
	`priority` integer,
	`weight` integer,
	`weightAdjustment` integer,
	`scheduleId` integer,
	`createdAt` integer NOT NULL,
	`groupId` text,
	`memberId` integer,
	PRIMARY KEY(`userId`, `eventTypeId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`scheduleId`) REFERENCES `Schedule`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`groupId`) REFERENCES `HostGroup`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`memberId`) REFERENCES `Membership`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Host_memberId_idx` ON `Host` (`memberId`);--> statement-breakpoint
CREATE INDEX `Host_userId_idx` ON `Host` (`userId`);--> statement-breakpoint
CREATE INDEX `Host_eventTypeId_idx` ON `Host` (`eventTypeId`);--> statement-breakpoint
CREATE INDEX `Host_scheduleId_idx` ON `Host` (`scheduleId`);--> statement-breakpoint
CREATE TABLE `HostGroup` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`eventTypeId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `HostGroup_name_idx` ON `HostGroup` (`name`);--> statement-breakpoint
CREATE INDEX `HostGroup_eventTypeId_idx` ON `HostGroup` (`eventTypeId`);--> statement-breakpoint
CREATE TABLE `HostLocation` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`eventTypeId` integer NOT NULL,
	`type` text NOT NULL,
	`credentialId` integer,
	`link` text,
	`address` text,
	`phoneNumber` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`credentialId`) REFERENCES `Credential`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`userId`,`eventTypeId`) REFERENCES `Host`(`userId`,`eventTypeId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `HostLocation_credentialId_idx` ON `HostLocation` (`credentialId`);--> statement-breakpoint
CREATE INDEX `HostLocation_eventTypeId_idx` ON `HostLocation` (`eventTypeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `HostLocation_userId_eventTypeId_key` ON `HostLocation` (`userId`,`eventTypeId`);--> statement-breakpoint
CREATE TABLE `InstantMeetingToken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	`teamId` integer NOT NULL,
	`bookingId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `InstantMeetingToken_token_key` ON `InstantMeetingToken` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `InstantMeetingToken_bookingId_key` ON `InstantMeetingToken` (`bookingId`);--> statement-breakpoint
CREATE INDEX `InstantMeetingToken_token_idx` ON `InstantMeetingToken` (`token`);--> statement-breakpoint
CREATE TABLE `IntegrationAttributeSync` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` integer NOT NULL,
	`name` text NOT NULL,
	`integration` text NOT NULL,
	`credentialId` integer,
	`enabled` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`credentialId`) REFERENCES `Credential`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `IntegrationAttributeSync_organizationId_idx` ON `IntegrationAttributeSync` (`organizationId`);--> statement-breakpoint
CREATE INDEX `IntegrationAttributeSync_credentialId_idx` ON `IntegrationAttributeSync` (`credentialId`);--> statement-breakpoint
CREATE TABLE `InternalNotePreset` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`cancellationReason` text,
	`teamId` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `InternalNotePreset_teamId_idx` ON `InternalNotePreset` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `InternalNotePreset_teamId_name_key` ON `InternalNotePreset` (`teamId`,`name`);--> statement-breakpoint
CREATE TABLE `ManagedOrganization` (
	`managedOrganizationId` integer NOT NULL,
	`managerOrganizationId` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`managedOrganizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`managerOrganizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ManagedOrganization_managedOrganizationId_key` ON `ManagedOrganization` (`managedOrganizationId`);--> statement-breakpoint
CREATE INDEX `ManagedOrganization_managerOrganizationId_idx` ON `ManagedOrganization` (`managerOrganizationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `ManagedOrganization_managerOrganizationId_managedOrganizationId_key` ON `ManagedOrganization` (`managerOrganizationId`,`managedOrganizationId`);--> statement-breakpoint
CREATE TABLE `Membership` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teamId` integer NOT NULL,
	`userId` integer NOT NULL,
	`accepted` integer DEFAULT false NOT NULL,
	`role` text NOT NULL,
	`customRoleId` text,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`customRoleId`) REFERENCES `Role`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Membership_teamId_idx` ON `Membership` (`teamId`);--> statement-breakpoint
CREATE INDEX `Membership_userId_idx` ON `Membership` (`userId`);--> statement-breakpoint
CREATE INDEX `Membership_accepted_idx` ON `Membership` (`accepted`);--> statement-breakpoint
CREATE INDEX `Membership_role_idx` ON `Membership` (`role`);--> statement-breakpoint
CREATE INDEX `Membership_customRoleId_idx` ON `Membership` (`customRoleId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Membership_userId_teamId_key` ON `Membership` (`userId`,`teamId`);--> statement-breakpoint
CREATE TABLE `MonthlyProration` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` integer NOT NULL,
	`monthKey` text NOT NULL,
	`periodStart` integer NOT NULL,
	`periodEnd` integer NOT NULL,
	`seatsAtStart` integer NOT NULL,
	`seatsAdded` integer NOT NULL,
	`seatsRemoved` integer NOT NULL,
	`netSeatIncrease` integer NOT NULL,
	`seatsAtEnd` integer NOT NULL,
	`subscriptionId` text NOT NULL,
	`subscriptionItemId` text NOT NULL,
	`customerId` text NOT NULL,
	`subscriptionStart` integer NOT NULL,
	`subscriptionEnd` integer NOT NULL,
	`remainingDays` integer NOT NULL,
	`pricePerSeat` integer NOT NULL,
	`proratedAmount` integer NOT NULL,
	`invoiceItemId` text,
	`invoiceId` text,
	`invoiceUrl` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`chargedAt` integer,
	`failedAt` integer,
	`failureReason` text,
	`retryCount` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`teamBillingId` text,
	`organizationBillingId` text,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamBillingId`) REFERENCES `TeamBilling`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`organizationBillingId`) REFERENCES `OrganizationBilling`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `MonthlyProration_monthKey_status_idx` ON `MonthlyProration` (`monthKey`,`status`);--> statement-breakpoint
CREATE INDEX `MonthlyProration_status_idx` ON `MonthlyProration` (`status`);--> statement-breakpoint
CREATE INDEX `MonthlyProration_teamId_idx` ON `MonthlyProration` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `MonthlyProration_teamId_monthKey_key` ON `MonthlyProration` (`teamId`,`monthKey`);--> statement-breakpoint
CREATE TABLE `NotificationsSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`subscription` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `NotificationsSubscriptions_userId_subscription_idx` ON `NotificationsSubscriptions` (`userId`,`subscription`);--> statement-breakpoint
CREATE TABLE `OAuthClient` (
	`clientId` text PRIMARY KEY NOT NULL,
	`redirectUri` text NOT NULL,
	`clientSecret` text,
	`clientType` text DEFAULT 'CONFIDENTIAL' NOT NULL,
	`name` text NOT NULL,
	`purpose` text,
	`logo` text,
	`websiteUrl` text,
	`rejectionReason` text,
	`isTrusted` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`userId` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `OAuthClient_userId_idx` ON `OAuthClient` (`userId`);--> statement-breakpoint
CREATE TABLE `OrganizationBilling` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` integer NOT NULL,
	`subscriptionId` text NOT NULL,
	`subscriptionItemId` text NOT NULL,
	`customerId` text NOT NULL,
	`status` text NOT NULL,
	`planName` text NOT NULL,
	`subscriptionStart` integer,
	`subscriptionTrialEnd` integer,
	`subscriptionEnd` integer,
	`billingPeriod` text,
	`billingMode` text DEFAULT 'SEATS' NOT NULL,
	`pricePerSeat` integer,
	`paidSeats` integer,
	`highWaterMark` integer,
	`highWaterMarkPeriodStart` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OrganizationBilling_teamId_key` ON `OrganizationBilling` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `OrganizationBilling_subscriptionId_key` ON `OrganizationBilling` (`subscriptionId`);--> statement-breakpoint
CREATE TABLE `OrganizationOnboarding` (
	`id` text PRIMARY KEY NOT NULL,
	`createdById` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`orgOwnerEmail` text NOT NULL,
	`error` text,
	`updatedAt` integer NOT NULL,
	`organizationId` integer,
	`billingPeriod` text NOT NULL,
	`pricePerSeat` real NOT NULL,
	`seats` integer NOT NULL,
	`isPlatform` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`bio` text,
	`brandColor` text,
	`bannerUrl` text,
	`isDomainConfigured` integer DEFAULT false NOT NULL,
	`stripeCustomerId` text,
	`stripeSubscriptionId` text,
	`stripeSubscriptionItemId` text,
	`invitedMembers` text NOT NULL,
	`teams` text NOT NULL,
	`isComplete` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OrganizationOnboarding_orgOwnerEmail_key` ON `OrganizationOnboarding` (`orgOwnerEmail`);--> statement-breakpoint
CREATE UNIQUE INDEX `OrganizationOnboarding_organizationId_key` ON `OrganizationOnboarding` (`organizationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `OrganizationOnboarding_stripeCustomerId_key` ON `OrganizationOnboarding` (`stripeCustomerId`);--> statement-breakpoint
CREATE INDEX `OrganizationOnboarding_orgOwnerEmail_idx` ON `OrganizationOnboarding` (`orgOwnerEmail`);--> statement-breakpoint
CREATE INDEX `OrganizationOnboarding_stripeCustomerId_idx` ON `OrganizationOnboarding` (`stripeCustomerId`);--> statement-breakpoint
CREATE TABLE `OrganizationSettings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` integer NOT NULL,
	`isOrganizationConfigured` integer DEFAULT false NOT NULL,
	`isOrganizationVerified` integer DEFAULT false NOT NULL,
	`orgAutoAcceptEmail` text NOT NULL,
	`lockEventTypeCreationForUsers` integer DEFAULT false NOT NULL,
	`adminGetsNoSlotsNotification` integer DEFAULT false NOT NULL,
	`isAdminReviewed` integer DEFAULT false NOT NULL,
	`isAdminAPIEnabled` integer DEFAULT false NOT NULL,
	`allowSEOIndexing` integer DEFAULT false NOT NULL,
	`orgProfileRedirectsToVerifiedDomain` integer DEFAULT false NOT NULL,
	`disablePhoneOnlySMSNotifications` integer DEFAULT false NOT NULL,
	`disableAutofillOnBookingPage` integer DEFAULT false NOT NULL,
	`orgAutoJoinOnSignup` integer DEFAULT true NOT NULL,
	`disableAttendeeConfirmationEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeCancellationEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeRescheduledEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeRequestEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeReassignedEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeAwaitingPaymentEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeRescheduleRequestEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeLocationChangeEmail` integer DEFAULT false NOT NULL,
	`disableAttendeeNewEventEmail` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OrganizationSettings_organizationId_key` ON `OrganizationSettings` (`organizationId`);--> statement-breakpoint
CREATE TABLE `OutOfOfficeEntry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`notes` text,
	`showNotePublicly` integer DEFAULT false NOT NULL,
	`userId` integer NOT NULL,
	`toUserId` integer,
	`reasonId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`toUserId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`reasonId`) REFERENCES `OutOfOfficeReason`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OutOfOfficeEntry_uuid_key` ON `OutOfOfficeEntry` (`uuid`);--> statement-breakpoint
CREATE INDEX `OutOfOfficeEntry_uuid_idx` ON `OutOfOfficeEntry` (`uuid`);--> statement-breakpoint
CREATE INDEX `OutOfOfficeEntry_userId_idx` ON `OutOfOfficeEntry` (`userId`);--> statement-breakpoint
CREATE INDEX `OutOfOfficeEntry_toUserId_idx` ON `OutOfOfficeEntry` (`toUserId`);--> statement-breakpoint
CREATE INDEX `OutOfOfficeEntry_start_end_idx` ON `OutOfOfficeEntry` (`start`,`end`);--> statement-breakpoint
CREATE TABLE `OutOfOfficeReason` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`emoji` text NOT NULL,
	`reason` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`userId` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OutOfOfficeReason_reason_key` ON `OutOfOfficeReason` (`reason`);--> statement-breakpoint
CREATE TABLE `Payment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`appId` text,
	`bookingId` integer NOT NULL,
	`amount` integer NOT NULL,
	`fee` integer NOT NULL,
	`currency` text NOT NULL,
	`success` integer NOT NULL,
	`refunded` integer NOT NULL,
	`data` text NOT NULL,
	`externalId` text NOT NULL,
	`paymentOption` text DEFAULT 'ON_BOOKING',
	FOREIGN KEY (`appId`) REFERENCES `App`(`slug`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Payment_uid_key` ON `Payment` (`uid`);--> statement-breakpoint
CREATE UNIQUE INDEX `Payment_externalId_key` ON `Payment` (`externalId`);--> statement-breakpoint
CREATE INDEX `Payment_bookingId_idx` ON `Payment` (`bookingId`);--> statement-breakpoint
CREATE INDEX `Payment_externalId_idx` ON `Payment` (`externalId`);--> statement-breakpoint
CREATE TABLE `PlatformAuthorizationToken` (
	`id` text PRIMARY KEY NOT NULL,
	`platformOAuthClientId` text NOT NULL,
	`userId` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`platformOAuthClientId`) REFERENCES `PlatformOAuthClient`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `PlatformAuthorizationToken_userId_platformOAuthClientId_key` ON `PlatformAuthorizationToken` (`userId`,`platformOAuthClientId`);--> statement-breakpoint
CREATE TABLE `PlatformBilling` (
	`id` integer PRIMARY KEY NOT NULL,
	`customerId` text NOT NULL,
	`subscriptionId` text,
	`priceId` text,
	`plan` text DEFAULT 'none' NOT NULL,
	`billingCycleStart` integer,
	`billingCycleEnd` integer,
	`overdue` integer DEFAULT false,
	`managerBillingId` integer,
	FOREIGN KEY (`id`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`managerBillingId`) REFERENCES `PlatformBilling`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `PlatformOAuthClient` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`secret` text NOT NULL,
	`permissions` integer NOT NULL,
	`logo` text,
	`redirectUris` text NOT NULL,
	`organizationId` integer NOT NULL,
	`bookingRedirectUri` text,
	`bookingCancelRedirectUri` text,
	`bookingRescheduleRedirectUri` text,
	`areEmailsEnabled` integer DEFAULT false NOT NULL,
	`areDefaultEventTypesEnabled` integer DEFAULT true NOT NULL,
	`areCalendarEventsEnabled` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`userId` integer NOT NULL,
	`organizationId` integer NOT NULL,
	`username` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Profile_uid_idx` ON `Profile` (`uid`);--> statement-breakpoint
CREATE INDEX `Profile_userId_idx` ON `Profile` (`userId`);--> statement-breakpoint
CREATE INDEX `Profile_organizationId_idx` ON `Profile` (`organizationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Profile_userId_organizationId_key` ON `Profile` (`userId`,`organizationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Profile_username_organizationId_key` ON `Profile` (`username`,`organizationId`);--> statement-breakpoint
CREATE TABLE `RateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`apiKeyId` text NOT NULL,
	`ttl` integer NOT NULL,
	`limit` integer NOT NULL,
	`blockDuration` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`apiKeyId`) REFERENCES `ApiKey`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `RateLimit_apiKeyId_idx` ON `RateLimit` (`apiKeyId`);--> statement-breakpoint
CREATE TABLE `RefreshToken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`secret` text NOT NULL,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`platformOAuthClientId` text NOT NULL,
	`userId` integer NOT NULL,
	FOREIGN KEY (`platformOAuthClientId`) REFERENCES `PlatformOAuthClient`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RefreshToken_secret_key` ON `RefreshToken` (`secret`);--> statement-breakpoint
CREATE TABLE `ReminderMail` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`referenceId` integer NOT NULL,
	`reminderType` text NOT NULL,
	`elapsedMinutes` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ReminderMail_referenceId_idx` ON `ReminderMail` (`referenceId`);--> statement-breakpoint
CREATE INDEX `ReminderMail_reminderType_idx` ON `ReminderMail` (`reminderType`);--> statement-breakpoint
CREATE TABLE `ResetPasswordRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`email` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Role` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`description` text,
	`teamId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`type` text DEFAULT 'CUSTOM' NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Role_teamId_idx` ON `Role` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Role_name_teamId_key` ON `Role` (`name`,`teamId`);--> statement-breakpoint
CREATE TABLE `RolePermission` (
	`id` text PRIMARY KEY NOT NULL,
	`roleId` text NOT NULL,
	`resource` text NOT NULL,
	`action` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `RolePermission_roleId_idx` ON `RolePermission` (`roleId`);--> statement-breakpoint
CREATE INDEX `RolePermission_action_idx` ON `RolePermission` (`action`);--> statement-breakpoint
CREATE UNIQUE INDEX `RolePermission_roleId_resource_action_key` ON `RolePermission` (`roleId`,`resource`,`action`);--> statement-breakpoint
CREATE TABLE `Schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text NOT NULL,
	`timeZone` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Schedule_userId_idx` ON `Schedule` (`userId`);--> statement-breakpoint
CREATE TABLE `SeatChangeLog` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` integer NOT NULL,
	`changeType` text NOT NULL,
	`seatCount` integer NOT NULL,
	`userId` integer,
	`triggeredBy` integer,
	`changeDate` integer NOT NULL,
	`monthKey` text NOT NULL,
	`operationId` text,
	`processedInProrationId` text,
	`metadata` text,
	`createdAt` integer NOT NULL,
	`teamBillingId` text,
	`organizationBillingId` text,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`processedInProrationId`) REFERENCES `MonthlyProration`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`teamBillingId`) REFERENCES `TeamBilling`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`organizationBillingId`) REFERENCES `OrganizationBilling`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `SeatChangeLog_teamId_monthKey_idx` ON `SeatChangeLog` (`teamId`,`monthKey`);--> statement-breakpoint
CREATE INDEX `SeatChangeLog_teamId_processedInProrationId_idx` ON `SeatChangeLog` (`teamId`,`processedInProrationId`);--> statement-breakpoint
CREATE INDEX `SeatChangeLog_monthKey_idx` ON `SeatChangeLog` (`monthKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `SeatChangeLog_teamId_operationId_key` ON `SeatChangeLog` (`teamId`,`operationId`);--> statement-breakpoint
CREATE TABLE `SecondaryEmail` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SecondaryEmail_email_key` ON `SecondaryEmail` (`email`);--> statement-breakpoint
CREATE INDEX `SecondaryEmail_userId_idx` ON `SecondaryEmail` (`userId`);--> statement-breakpoint
CREATE INDEX `SecondaryEmail_email_emailVerified_idx` ON `SecondaryEmail` (`email`,`emailVerified`);--> statement-breakpoint
CREATE UNIQUE INDEX `SecondaryEmail_userId_email_key` ON `SecondaryEmail` (`userId`,`email`);--> statement-breakpoint
CREATE TABLE `SelectedCalendar` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`integration` text NOT NULL,
	`externalId` text NOT NULL,
	`credentialId` integer,
	`createdAt` integer,
	`updatedAt` integer,
	`googleChannelId` text,
	`googleChannelKind` text,
	`googleChannelResourceId` text,
	`googleChannelResourceUri` text,
	`googleChannelExpiration` text,
	`channelId` text,
	`channelKind` text,
	`channelResourceId` text,
	`channelResourceUri` text,
	`channelExpiration` integer,
	`syncSubscribedAt` integer,
	`syncSubscribedErrorAt` integer,
	`syncSubscribedErrorCount` integer DEFAULT 0 NOT NULL,
	`syncToken` text,
	`syncedAt` integer,
	`syncErrorAt` integer,
	`syncErrorCount` integer DEFAULT 0,
	`delegationCredentialId` text,
	`error` text,
	`lastErrorAt` integer,
	`watchAttempts` integer DEFAULT 0 NOT NULL,
	`unwatchAttempts` integer DEFAULT 0 NOT NULL,
	`maxAttempts` integer DEFAULT 3 NOT NULL,
	`eventTypeId` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`credentialId`) REFERENCES `Credential`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`delegationCredentialId`) REFERENCES `DelegationCredential`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `SelectedCalendar_userId_idx` ON `SelectedCalendar` (`userId`);--> statement-breakpoint
CREATE INDEX `SelectedCalendar_externalId_idx` ON `SelectedCalendar` (`externalId`);--> statement-breakpoint
CREATE INDEX `SelectedCalendar_eventTypeId_idx` ON `SelectedCalendar` (`eventTypeId`);--> statement-breakpoint
CREATE INDEX `SelectedCalendar_credentialId_idx` ON `SelectedCalendar` (`credentialId`);--> statement-breakpoint
CREATE INDEX `SelectedCalendar_channelId_idx` ON `SelectedCalendar` (`channelId`);--> statement-breakpoint
CREATE INDEX `SelectedCalendar_watch_idx` ON `SelectedCalendar` (`integration`,`googleChannelExpiration`,`error`,`watchAttempts`,`maxAttempts`);--> statement-breakpoint
CREATE INDEX `SelectedCalendar_unwatch_idx` ON `SelectedCalendar` (`integration`,`googleChannelExpiration`,`error`,`unwatchAttempts`,`maxAttempts`);--> statement-breakpoint
CREATE UNIQUE INDEX `SelectedCalendar_userId_integration_externalId_eventTypeId_key` ON `SelectedCalendar` (`userId`,`integration`,`externalId`,`eventTypeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `SelectedCalendar_googleChannelId_eventTypeId_key` ON `SelectedCalendar` (`googleChannelId`,`eventTypeId`);--> statement-breakpoint
CREATE TABLE `SelectedSlots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventTypeId` integer NOT NULL,
	`userId` integer NOT NULL,
	`slotUtcStartDate` integer NOT NULL,
	`slotUtcEndDate` integer NOT NULL,
	`uid` text NOT NULL,
	`releaseAt` integer NOT NULL,
	`isSeat` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SelectedSlots_userId_slotUtcStartDate_slotUtcEndDate_uid_key` ON `SelectedSlots` (`userId`,`slotUtcStartDate`,`slotUtcEndDate`,`uid`);--> statement-breakpoint
CREATE TABLE `Session` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionToken` text NOT NULL,
	`userId` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Session_sessionToken_key` ON `Session` (`sessionToken`);--> statement-breakpoint
CREATE INDEX `Session_userId_idx` ON `Session` (`userId`);--> statement-breakpoint
CREATE TABLE `Task` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`scheduledAt` integer NOT NULL,
	`succeededAt` integer,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`maxAttempts` integer DEFAULT 3 NOT NULL,
	`lastError` text,
	`lastFailedAttemptAt` integer,
	`referenceUid` text
);
--> statement-breakpoint
CREATE INDEX `Task_succeededAt_idx` ON `Task` (`succeededAt`);--> statement-breakpoint
CREATE INDEX `Task_scheduledAt_succeededAt_idx` ON `Task` (`scheduledAt`,`succeededAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `Task_referenceUid_type_key` ON `Task` (`referenceUid`,`type`);--> statement-breakpoint
CREATE TABLE `Team` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`logoUrl` text,
	`calVideoLogo` text,
	`appLogo` text,
	`appIconLogo` text,
	`bio` text,
	`hideBranding` integer DEFAULT false NOT NULL,
	`hideTeamProfileLink` integer DEFAULT false NOT NULL,
	`isPrivate` integer DEFAULT false NOT NULL,
	`hideBookATeamMember` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`metadata` text,
	`theme` text,
	`rrResetInterval` text DEFAULT 'MONTH',
	`rrTimestampBasis` text DEFAULT 'CREATED_AT' NOT NULL,
	`brandColor` text,
	`darkBrandColor` text,
	`bannerUrl` text,
	`parentId` integer,
	`timeFormat` integer,
	`timeZone` text DEFAULT 'Europe/London' NOT NULL,
	`weekStart` text DEFAULT 'Sunday' NOT NULL,
	`isOrganization` integer DEFAULT false NOT NULL,
	`pendingPayment` integer DEFAULT false NOT NULL,
	`isPlatform` integer DEFAULT false NOT NULL,
	`createdByOAuthClientId` text,
	`smsLockState` text DEFAULT 'UNLOCKED' NOT NULL,
	`smsLockReviewedByAdmin` integer DEFAULT false NOT NULL,
	`bookingLimits` text,
	`includeManagedEventsInLimits` integer DEFAULT false NOT NULL,
	`autoOptInFeatures` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`createdByOAuthClientId`) REFERENCES `PlatformOAuthClient`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Team_parentId_idx` ON `Team` (`parentId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Team_slug_parentId_key` ON `Team` (`slug`,`parentId`);--> statement-breakpoint
CREATE TABLE `TeamBilling` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` integer NOT NULL,
	`subscriptionId` text NOT NULL,
	`subscriptionItemId` text NOT NULL,
	`customerId` text NOT NULL,
	`status` text NOT NULL,
	`planName` text NOT NULL,
	`subscriptionStart` integer,
	`subscriptionTrialEnd` integer,
	`subscriptionEnd` integer,
	`billingPeriod` text,
	`billingMode` text DEFAULT 'SEATS' NOT NULL,
	`pricePerSeat` integer,
	`paidSeats` integer,
	`highWaterMark` integer,
	`highWaterMarkPeriodStart` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TeamBilling_teamId_key` ON `TeamBilling` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `TeamBilling_subscriptionId_key` ON `TeamBilling` (`subscriptionId`);--> statement-breakpoint
CREATE TABLE `TeamFeatures` (
	`teamId` integer NOT NULL,
	`featureId` text NOT NULL,
	`enabled` integer NOT NULL,
	`assignedAt` integer NOT NULL,
	`assignedBy` text NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`teamId`, `featureId`),
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`featureId`) REFERENCES `Feature`(`slug`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TeamFeatures_teamId_featureId_idx` ON `TeamFeatures` (`teamId`,`featureId`);--> statement-breakpoint
CREATE TABLE `TempOrgRedirect` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from` text NOT NULL,
	`fromOrgId` integer NOT NULL,
	`type` text NOT NULL,
	`toUrl` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TempOrgRedirect_from_type_fromOrgId_key` ON `TempOrgRedirect` (`from`,`type`,`fromOrgId`);--> statement-breakpoint
CREATE TABLE `Tracking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookingId` integer NOT NULL,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`utm_term` text,
	`utm_content` text,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Tracking_bookingId_key` ON `Tracking` (`bookingId`);--> statement-breakpoint
CREATE TABLE `TravelSchedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`timeZone` text NOT NULL,
	`startDate` integer NOT NULL,
	`endDate` integer,
	`prevTimeZone` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TravelSchedule_startDate_idx` ON `TravelSchedule` (`startDate`);--> statement-breakpoint
CREATE INDEX `TravelSchedule_endDate_idx` ON `TravelSchedule` (`endDate`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`username` text,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`bio` text,
	`avatarUrl` text,
	`timeZone` text DEFAULT 'Europe/London' NOT NULL,
	`weekStart` text DEFAULT 'Sunday' NOT NULL,
	`bufferTime` integer DEFAULT 0 NOT NULL,
	`hideBranding` integer DEFAULT false NOT NULL,
	`theme` text,
	`appTheme` text,
	`created` integer NOT NULL,
	`trialEndsAt` integer,
	`lastActiveAt` integer,
	`defaultScheduleId` integer,
	`completedOnboarding` integer DEFAULT false NOT NULL,
	`locale` text,
	`timeFormat` integer DEFAULT 12,
	`twoFactorSecret` text,
	`twoFactorEnabled` integer DEFAULT false NOT NULL,
	`backupCodes` text,
	`identityProvider` text DEFAULT 'CAL' NOT NULL,
	`identityProviderId` text,
	`invitedTo` integer,
	`brandColor` text,
	`darkBrandColor` text,
	`allowDynamicBooking` integer DEFAULT true,
	`allowSEOIndexing` integer DEFAULT true,
	`receiveMonthlyDigestEmail` integer DEFAULT true,
	`requiresBookerEmailVerification` integer DEFAULT false,
	`metadata` text,
	`verified` integer DEFAULT false,
	`role` text DEFAULT 'USER' NOT NULL,
	`organizationId` integer,
	`locked` integer DEFAULT false NOT NULL,
	`movedToProfileId` integer,
	`isPlatformManaged` integer DEFAULT false NOT NULL,
	`smsLockState` text DEFAULT 'UNLOCKED' NOT NULL,
	`smsLockReviewedByAdmin` integer DEFAULT false NOT NULL,
	`referralLinkId` text,
	`creationSource` text,
	`autoOptInFeatures` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`movedToProfileId`) REFERENCES `Profile`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_uuid_key` ON `users` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_movedToProfileId_key` ON `users` (`movedToProfileId`);--> statement-breakpoint
CREATE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_emailVerified_idx` ON `users` (`emailVerified`);--> statement-breakpoint
CREATE INDEX `users_identityProvider_idx` ON `users` (`identityProvider`);--> statement-breakpoint
CREATE INDEX `users_identityProviderId_idx` ON `users` (`identityProviderId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_username_key` ON `users` (`email`,`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_organizationId_key` ON `users` (`username`,`organizationId`);--> statement-breakpoint
CREATE TABLE `UserFeatures` (
	`userId` integer NOT NULL,
	`featureId` text NOT NULL,
	`enabled` integer NOT NULL,
	`assignedAt` integer NOT NULL,
	`assignedBy` text NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `featureId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`featureId`) REFERENCES `Feature`(`slug`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `UserFeatures_userId_featureId_idx` ON `UserFeatures` (`userId`,`featureId`);--> statement-breakpoint
CREATE TABLE `UserFilterSegmentPreference` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`tableIdentifier` text NOT NULL,
	`segmentId` integer,
	`systemSegmentId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`segmentId`) REFERENCES `FilterSegment`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `UserFilterSegmentPreference_userId_idx` ON `UserFilterSegmentPreference` (`userId`);--> statement-breakpoint
CREATE INDEX `UserFilterSegmentPreference_segmentId_idx` ON `UserFilterSegmentPreference` (`segmentId`);--> statement-breakpoint
CREATE UNIQUE INDEX `UserFilterSegmentPreference_userId_tableIdentifier_key` ON `UserFilterSegmentPreference` (`userId`,`tableIdentifier`);--> statement-breakpoint
CREATE TABLE `UserHolidaySettings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`countryCode` text,
	`disabledIds` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UserHolidaySettings_userId_key` ON `UserHolidaySettings` (`userId`);--> statement-breakpoint
CREATE TABLE `UserPassword` (
	`hash` text NOT NULL,
	`userId` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UserPassword_userId_key` ON `UserPassword` (`userId`);--> statement-breakpoint
CREATE TABLE `VerificationToken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	`expiresInDays` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`teamId` integer,
	`secondaryEmailId` integer,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`secondaryEmailId`) REFERENCES `SecondaryEmail`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_token_key` ON `VerificationToken` (`token`);--> statement-breakpoint
CREATE INDEX `VerificationToken_token_idx` ON `VerificationToken` (`token`);--> statement-breakpoint
CREATE INDEX `VerificationToken_teamId_idx` ON `VerificationToken` (`teamId`);--> statement-breakpoint
CREATE INDEX `VerificationToken_secondaryEmailId_idx` ON `VerificationToken` (`secondaryEmailId`);--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_identifier_token_key` ON `VerificationToken` (`identifier`,`token`);--> statement-breakpoint
CREATE TABLE `VerifiedEmail` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`teamId` integer,
	`email` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `VerifiedEmail_userId_idx` ON `VerifiedEmail` (`userId`);--> statement-breakpoint
CREATE INDEX `VerifiedEmail_teamId_idx` ON `VerifiedEmail` (`teamId`);--> statement-breakpoint
CREATE TABLE `VerifiedNumber` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`teamId` integer,
	`phoneNumber` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `VerifiedNumber_userId_idx` ON `VerifiedNumber` (`userId`);--> statement-breakpoint
CREATE INDEX `VerifiedNumber_teamId_idx` ON `VerifiedNumber` (`teamId`);--> statement-breakpoint
CREATE TABLE `VideoCallGuest` (
	`id` text PRIMARY KEY NOT NULL,
	`bookingUid` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`joinedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `VideoCallGuest_bookingUid_idx` ON `VideoCallGuest` (`bookingUid`);--> statement-breakpoint
CREATE INDEX `VideoCallGuest_email_idx` ON `VideoCallGuest` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `VideoCallGuest_bookingUid_email_key` ON `VideoCallGuest` (`bookingUid`,`email`);--> statement-breakpoint
CREATE TABLE `Watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`isGlobal` integer DEFAULT false NOT NULL,
	`organizationId` integer,
	`action` text DEFAULT 'REPORT' NOT NULL,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`lastUpdatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Watchlist_isGlobal_action_organizationId_type_value_idx` ON `Watchlist` (`isGlobal`,`action`,`organizationId`,`type`,`value`);--> statement-breakpoint
CREATE UNIQUE INDEX `Watchlist_type_value_organizationId_key` ON `Watchlist` (`type`,`value`,`organizationId`);--> statement-breakpoint
CREATE TABLE `WatchlistAudit` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`action` text DEFAULT 'REPORT' NOT NULL,
	`changedAt` integer NOT NULL,
	`changedByUserId` integer,
	`watchlistId` text,
	FOREIGN KEY (`watchlistId`) REFERENCES `Watchlist`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `WatchlistAudit_watchlistId_changedAt_idx` ON `WatchlistAudit` (`watchlistId`,`changedAt`);--> statement-breakpoint
CREATE TABLE `WatchlistEventAudit` (
	`id` text PRIMARY KEY NOT NULL,
	`watchlistId` text NOT NULL,
	`eventTypeId` integer NOT NULL,
	`actionTaken` text NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Webhook` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer,
	`teamId` integer,
	`eventTypeId` integer,
	`platformOAuthClientId` text,
	`subscriberUrl` text NOT NULL,
	`payloadTemplate` text,
	`createdAt` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`eventTriggers` text NOT NULL,
	`appId` text,
	`secret` text,
	`platform` integer DEFAULT false NOT NULL,
	`time` integer,
	`timeUnit` text,
	`version` text DEFAULT '2021-10-20' NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventTypeId`) REFERENCES `EventType`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`platformOAuthClientId`) REFERENCES `PlatformOAuthClient`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`appId`) REFERENCES `App`(`slug`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Webhook_active_idx` ON `Webhook` (`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `Webhook_userId_subscriberUrl_key` ON `Webhook` (`userId`,`subscriberUrl`);--> statement-breakpoint
CREATE UNIQUE INDEX `Webhook_platformOAuthClientId_subscriberUrl_key` ON `Webhook` (`platformOAuthClientId`,`subscriberUrl`);--> statement-breakpoint
CREATE TABLE `WebhookScheduledTriggers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jobName` text,
	`subscriberUrl` text NOT NULL,
	`payload` text NOT NULL,
	`startAfter` integer NOT NULL,
	`retryCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer,
	`appId` text,
	`webhookId` text,
	`bookingId` integer,
	FOREIGN KEY (`webhookId`) REFERENCES `Webhook`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `WorkspacePlatform` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`defaultServiceAccountKey` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `WorkspacePlatform_slug_key` ON `WorkspacePlatform` (`slug`);--> statement-breakpoint
CREATE TABLE `WrongAssignmentReport` (
	`id` text PRIMARY KEY NOT NULL,
	`bookingUid` text NOT NULL,
	`reportedById` integer,
	`correctAssignee` text,
	`additionalNotes` text NOT NULL,
	`teamId` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewedById` integer,
	`reviewedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`bookingUid`) REFERENCES `Booking`(`uid`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`reportedById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `WrongAssignmentReport_bookingUid_key` ON `WrongAssignmentReport` (`bookingUid`);--> statement-breakpoint
CREATE INDEX `WrongAssignmentReport_reportedById_idx` ON `WrongAssignmentReport` (`reportedById`);--> statement-breakpoint
CREATE INDEX `WrongAssignmentReport_teamId_idx` ON `WrongAssignmentReport` (`teamId`);--> statement-breakpoint
CREATE INDEX `WrongAssignmentReport_status_idx` ON `WrongAssignmentReport` (`status`);--> statement-breakpoint
CREATE INDEX `WrongAssignmentReport_reviewedById_idx` ON `WrongAssignmentReport` (`reviewedById`);--> statement-breakpoint
CREATE INDEX `WrongAssignmentReport_createdAt_idx` ON `WrongAssignmentReport` (`createdAt`);--> statement-breakpoint
CREATE INDEX `WrongAssignmentReport_teamId_status_createdAt_idx` ON `WrongAssignmentReport` (`teamId`,`status`,`createdAt`);