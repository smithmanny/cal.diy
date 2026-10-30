// Generated from packages/prisma/schema.prisma, then maintained by hand.
// SQLite (Cloudflare D1 / libSQL) dialect. Postgres arrays and Json are stored as JSON text,
// enums as constrained TEXT, DateTime as integer milliseconds.
import {
  type AnySQLiteColumn,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { AccessScope, AppCategories, WebhookTriggerEvents } from "./enums";
import {
  assignmentReasonEnumValues,
  attributeTypeValues,
  auditActorTypeValues,
  billingModeValues,
  billingPeriodValues,
  bookingAuditActionValues,
  bookingAuditSourceValues,
  bookingAuditTypeValues,
  bookingReportReasonValues,
  bookingReportStatusValues,
  bookingStatusValues,
  calendarCacheEventStatusValues,
  cancellationReasonRequirementValues,
  creationSourceValues,
  creditTypeValues,
  creditUsageTypeValues,
  eventTypeAutoTranslatedFieldValues,
  eventTypeCustomInputTypeValues,
  featureTypeValues,
  filterSegmentScopeValues,
  identityProviderValues,
  membershipRoleValues,
  oAuthClientStatusValues,
  oAuthClientTypeValues,
  paymentOptionValues,
  periodTypeValues,
  phoneNumberSubscriptionStatusValues,
  prorationStatusValues,
  redirectTypeValues,
  reminderTypeValues,
  roleTypeValues,
  rRResetIntervalValues,
  rRTimestampBasisValues,
  schedulingTypeValues,
  seatChangeTypeValues,
  sMSLockStateValues,
  systemReportStatusValues,
  timeUnitValues,
  userPermissionRoleValues,
  watchlistActionValues,
  watchlistSourceValues,
  watchlistTypeValues,
  wrongAssignmentReportStatusValues,
} from "./enums";
import { cuid, type JsonValue, uuidv7 } from "./ids";

export const host = sqliteTable(
  "Host",
  {
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    eventTypeId: integer("eventTypeId")
      .notNull()
      .references((): AnySQLiteColumn => eventType.id, { onDelete: "cascade", onUpdate: "cascade" }),
    isFixed: integer("isFixed", { mode: "boolean" }).notNull().default(false),
    priority: integer("priority"),
    weight: integer("weight"),
    weightAdjustment: integer("weightAdjustment"),
    scheduleId: integer("scheduleId").references((): AnySQLiteColumn => schedule.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    groupId: text("groupId").references((): AnySQLiteColumn => hostGroup.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    memberId: integer("memberId").references((): AnySQLiteColumn => membership.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.eventTypeId] }),
    index("Host_memberId_idx").on(t.memberId),
    index("Host_userId_idx").on(t.userId),
    index("Host_eventTypeId_idx").on(t.eventTypeId),
    index("Host_scheduleId_idx").on(t.scheduleId),
  ]
);

export const hostGroup = sqliteTable(
  "HostGroup",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    eventTypeId: integer("eventTypeId").references((): AnySQLiteColumn => eventType.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [index("HostGroup_name_idx").on(t.name), index("HostGroup_eventTypeId_idx").on(t.eventTypeId)]
);

export const hostLocation = sqliteTable(
  "HostLocation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: integer("userId").notNull(),
    eventTypeId: integer("eventTypeId").notNull(),
    type: text("type").notNull(),
    credentialId: integer("credentialId").references((): AnySQLiteColumn => credential.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    link: text("link"),
    address: text("address"),
    phoneNumber: text("phoneNumber"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("HostLocation_credentialId_idx").on(t.credentialId),
    index("HostLocation_eventTypeId_idx").on(t.eventTypeId),
    uniqueIndex("HostLocation_userId_eventTypeId_key").on(t.userId, t.eventTypeId),
    foreignKey({ columns: [t.userId, t.eventTypeId], foreignColumns: [host.userId, host.eventTypeId] })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
);

export const calVideoSettings = sqliteTable("CalVideoSettings", {
  eventTypeId: integer("eventTypeId")
    .primaryKey()
    .references((): AnySQLiteColumn => eventType.id, { onDelete: "cascade", onUpdate: "cascade" }),
  disableRecordingForOrganizer: integer("disableRecordingForOrganizer", { mode: "boolean" })
    .notNull()
    .default(false),
  disableRecordingForGuests: integer("disableRecordingForGuests", { mode: "boolean" })
    .notNull()
    .default(false),
  enableAutomaticTranscription: integer("enableAutomaticTranscription", { mode: "boolean" })
    .notNull()
    .default(false),
  enableAutomaticRecordingForOrganizer: integer("enableAutomaticRecordingForOrganizer", { mode: "boolean" })
    .notNull()
    .default(false),
  redirectUrlOnExit: text("redirectUrlOnExit"),
  disableTranscriptionForGuests: integer("disableTranscriptionForGuests", { mode: "boolean" })
    .notNull()
    .default(false),
  disableTranscriptionForOrganizer: integer("disableTranscriptionForOrganizer", { mode: "boolean" })
    .notNull()
    .default(false),
  requireEmailForGuests: integer("requireEmailForGuests", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const videoCallGuest = sqliteTable(
  "VideoCallGuest",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingUid: text("bookingUid").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    joinedAt: integer("joinedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("VideoCallGuest_bookingUid_idx").on(t.bookingUid),
    index("VideoCallGuest_email_idx").on(t.email),
    uniqueIndex("VideoCallGuest_bookingUid_email_key").on(t.bookingUid, t.email),
  ]
);

export const eventType = sqliteTable(
  "EventType",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    interfaceLanguage: text("interfaceLanguage"),
    position: integer("position").notNull().default(0),
    locations: text("locations", { mode: "json" }).$type<JsonValue>(),
    length: integer("length").notNull(),
    offsetStart: integer("offsetStart").notNull().default(0),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    profileId: integer("profileId").references((): AnySQLiteColumn => profile.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    useEventLevelSelectedCalendars: integer("useEventLevelSelectedCalendars", { mode: "boolean" })
      .notNull()
      .default(false),
    eventName: text("eventName"),
    parentId: integer("parentId").references((): AnySQLiteColumn => eventType.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    bookingFields: text("bookingFields", { mode: "json" }).$type<JsonValue>(),
    timeZone: text("timeZone"),
    periodType: text("periodType", { enum: periodTypeValues }).notNull().default("UNLIMITED"),
    periodStartDate: integer("periodStartDate", { mode: "timestamp_ms" }),
    periodEndDate: integer("periodEndDate", { mode: "timestamp_ms" }),
    periodDays: integer("periodDays"),
    periodCountCalendarDays: integer("periodCountCalendarDays", { mode: "boolean" }),
    lockTimeZoneToggleOnBookingPage: integer("lockTimeZoneToggleOnBookingPage", { mode: "boolean" })
      .notNull()
      .default(false),
    lockedTimeZone: text("lockedTimeZone"),
    requiresConfirmation: integer("requiresConfirmation", { mode: "boolean" }).notNull().default(false),
    requiresConfirmationWillBlockSlot: integer("requiresConfirmationWillBlockSlot", { mode: "boolean" })
      .notNull()
      .default(false),
    requiresConfirmationForFreeEmail: integer("requiresConfirmationForFreeEmail", { mode: "boolean" })
      .notNull()
      .default(false),
    requiresBookerEmailVerification: integer("requiresBookerEmailVerification", { mode: "boolean" })
      .notNull()
      .default(false),
    canSendCalVideoTranscriptionEmails: integer("canSendCalVideoTranscriptionEmails", { mode: "boolean" })
      .notNull()
      .default(true),
    autoTranslateDescriptionEnabled: integer("autoTranslateDescriptionEnabled", { mode: "boolean" })
      .notNull()
      .default(false),
    autoTranslateInstantMeetingTitleEnabled: integer("autoTranslateInstantMeetingTitleEnabled", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    recurringEvent: text("recurringEvent", { mode: "json" }).$type<JsonValue>(),
    disableGuests: integer("disableGuests", { mode: "boolean" }).notNull().default(false),
    hideCalendarNotes: integer("hideCalendarNotes", { mode: "boolean" }).notNull().default(false),
    hideCalendarEventDetails: integer("hideCalendarEventDetails", { mode: "boolean" })
      .notNull()
      .default(false),
    minimumBookingNotice: integer("minimumBookingNotice").notNull().default(120),
    beforeEventBuffer: integer("beforeEventBuffer").notNull().default(0),
    afterEventBuffer: integer("afterEventBuffer").notNull().default(0),
    seatsPerTimeSlot: integer("seatsPerTimeSlot"),
    onlyShowFirstAvailableSlot: integer("onlyShowFirstAvailableSlot", { mode: "boolean" })
      .notNull()
      .default(false),
    showOptimizedSlots: integer("showOptimizedSlots", { mode: "boolean" }).default(false),
    disableCancelling: integer("disableCancelling", { mode: "boolean" }).default(false),
    disableRescheduling: integer("disableRescheduling", { mode: "boolean" }).default(false),
    minimumRescheduleNotice: integer("minimumRescheduleNotice"),
    seatsShowAttendees: integer("seatsShowAttendees", { mode: "boolean" }).default(false),
    seatsShowAvailabilityCount: integer("seatsShowAvailabilityCount", { mode: "boolean" }).default(true),
    schedulingType: text("schedulingType", { enum: schedulingTypeValues }),
    scheduleId: integer("scheduleId").references((): AnySQLiteColumn => schedule.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    allowReschedulingCancelledBookings: integer("allowReschedulingCancelledBookings", {
      mode: "boolean",
    }).default(false),
    price: integer("price").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    slotInterval: integer("slotInterval"),
    metadata: text("metadata", { mode: "json" }).$type<JsonValue>(),
    successRedirectUrl: text("successRedirectUrl"),
    forwardParamsSuccessRedirect: integer("forwardParamsSuccessRedirect", { mode: "boolean" }).default(true),
    bookingLimits: text("bookingLimits", { mode: "json" }).$type<JsonValue>(),
    durationLimits: text("durationLimits", { mode: "json" }).$type<JsonValue>(),
    isInstantEvent: integer("isInstantEvent", { mode: "boolean" }).notNull().default(false),
    instantMeetingExpiryTimeOffsetInSeconds: integer("instantMeetingExpiryTimeOffsetInSeconds")
      .notNull()
      .default(90),
    instantMeetingScheduleId: integer("instantMeetingScheduleId").references(
      (): AnySQLiteColumn => schedule.id,
      { onDelete: "set null", onUpdate: "cascade" }
    ),
    instantMeetingParameters: text("instantMeetingParameters", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    assignAllTeamMembers: integer("assignAllTeamMembers", { mode: "boolean" }).notNull().default(false),
    assignRRMembersUsingSegment: integer("assignRRMembersUsingSegment", { mode: "boolean" })
      .notNull()
      .default(false),
    rrSegmentQueryValue: text("rrSegmentQueryValue", { mode: "json" }).$type<JsonValue>(),
    useEventTypeDestinationCalendarEmail: integer("useEventTypeDestinationCalendarEmail", { mode: "boolean" })
      .notNull()
      .default(false),
    isRRWeightsEnabled: integer("isRRWeightsEnabled", { mode: "boolean" }).notNull().default(false),
    maxLeadThreshold: integer("maxLeadThreshold"),
    includeNoShowInRRCalculation: integer("includeNoShowInRRCalculation", { mode: "boolean" })
      .notNull()
      .default(false),
    allowReschedulingPastBookings: integer("allowReschedulingPastBookings", { mode: "boolean" })
      .notNull()
      .default(false),
    hideOrganizerEmail: integer("hideOrganizerEmail", { mode: "boolean" }).notNull().default(false),
    maxActiveBookingsPerBooker: integer("maxActiveBookingsPerBooker"),
    maxActiveBookingPerBookerOfferReschedule: integer("maxActiveBookingPerBookerOfferReschedule", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    customReplyToEmail: text("customReplyToEmail"),
    eventTypeColor: text("eventTypeColor", { mode: "json" }).$type<JsonValue>(),
    rescheduleWithSameRoundRobinHost: integer("rescheduleWithSameRoundRobinHost", { mode: "boolean" })
      .notNull()
      .default(false),
    secondaryEmailId: integer("secondaryEmailId").references((): AnySQLiteColumn => secondaryEmail.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    useBookerTimezone: integer("useBookerTimezone", { mode: "boolean" }).notNull().default(false),
    restrictionScheduleId: integer("restrictionScheduleId").references((): AnySQLiteColumn => schedule.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    bookingRequiresAuthentication: integer("bookingRequiresAuthentication", { mode: "boolean" })
      .notNull()
      .default(false),
    rrHostSubsetEnabled: integer("rrHostSubsetEnabled", { mode: "boolean" }).notNull().default(false),
    requiresCancellationReason: text("requiresCancellationReason", {
      enum: cancellationReasonRequirementValues,
    }).default("MANDATORY_HOST_ONLY"),
    enablePerHostLocations: integer("enablePerHostLocations", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("EventType_userId_idx").on(t.userId),
    index("EventType_teamId_idx").on(t.teamId),
    index("EventType_profileId_idx").on(t.profileId),
    index("EventType_scheduleId_idx").on(t.scheduleId),
    index("EventType_secondaryEmailId_idx").on(t.secondaryEmailId),
    index("EventType_parentId_idx").on(t.parentId),
    index("EventType_parentId_teamId_idx").on(t.parentId, t.teamId),
    index("EventType_restrictionScheduleId_idx").on(t.restrictionScheduleId),
    uniqueIndex("EventType_userId_slug_key").on(t.userId, t.slug),
    uniqueIndex("EventType_teamId_slug_key").on(t.teamId, t.slug),
    uniqueIndex("EventType_userId_parentId_key").on(t.userId, t.parentId),
  ]
);

export const credential = sqliteTable(
  "Credential",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    key: text("key", { mode: "json" }).$type<JsonValue>().notNull(),
    encryptedKey: text("encryptedKey"),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    appId: text("appId").references((): AnySQLiteColumn => app.slug, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    subscriptionId: text("subscriptionId"),
    paymentStatus: text("paymentStatus"),
    billingCycleStart: integer("billingCycleStart"),
    invalid: integer("invalid", { mode: "boolean" }).default(false),
    delegationCredentialId: text("delegationCredentialId").references(
      (): AnySQLiteColumn => delegationCredential.id,
      { onDelete: "cascade", onUpdate: "cascade" }
    ),
  },
  (t) => [
    index("Credential_appId_idx").on(t.appId),
    index("Credential_subscriptionId_idx").on(t.subscriptionId),
    index("Credential_invalid_idx").on(t.invalid),
    index("Credential_userId_delegationCredentialId_idx").on(t.userId, t.delegationCredentialId),
    index("Credential_teamId_idx").on(t.teamId),
  ]
);

export const destinationCalendar = sqliteTable(
  "DestinationCalendar",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    integration: text("integration").notNull(),
    externalId: text("externalId").notNull(),
    primaryEmail: text("primaryEmail"),
    userId: integer("userId")
      .unique("DestinationCalendar_userId_key")
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    eventTypeId: integer("eventTypeId")
      .unique("DestinationCalendar_eventTypeId_key")
      .references((): AnySQLiteColumn => eventType.id, { onDelete: "cascade", onUpdate: "cascade" }),
    credentialId: integer("credentialId").references((): AnySQLiteColumn => credential.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    delegationCredentialId: text("delegationCredentialId").references(
      (): AnySQLiteColumn => delegationCredential.id,
      { onDelete: "cascade", onUpdate: "cascade" }
    ),
    customCalendarReminder: integer("customCalendarReminder"),
  },
  (t) => [
    index("DestinationCalendar_userId_idx").on(t.userId),
    index("DestinationCalendar_eventTypeId_idx").on(t.eventTypeId),
    index("DestinationCalendar_credentialId_idx").on(t.credentialId),
  ]
);

export const travelSchedule = sqliteTable(
  "TravelSchedule",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    timeZone: text("timeZone").notNull(),
    startDate: integer("startDate", { mode: "timestamp_ms" }).notNull(),
    endDate: integer("endDate", { mode: "timestamp_ms" }),
    prevTimeZone: text("prevTimeZone"),
  },
  (t) => [
    index("TravelSchedule_startDate_idx").on(t.startDate),
    index("TravelSchedule_endDate_idx").on(t.endDate),
  ]
);

export const user = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid")
      .notNull()
      .unique("users_uuid_key")
      .$defaultFn(() => crypto.randomUUID()),
    username: text("username"),
    name: text("name"),
    email: text("email").notNull().unique("users_email_key"),
    // Owned by Better Auth, which tracks verification as a flag rather than a timestamp.
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
    bio: text("bio"),
    avatarUrl: text("avatarUrl"),
    timeZone: text("timeZone").notNull().default("Europe/London"),
    weekStart: text("weekStart").notNull().default("Sunday"),
    bufferTime: integer("bufferTime").notNull().default(0),
    hideBranding: integer("hideBranding", { mode: "boolean" }).notNull().default(false),
    theme: text("theme"),
    appTheme: text("appTheme"),
    createdDate: integer("created", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    trialEndsAt: integer("trialEndsAt", { mode: "timestamp_ms" }),
    lastActiveAt: integer("lastActiveAt", { mode: "timestamp_ms" }),
    defaultScheduleId: integer("defaultScheduleId"),
    completedOnboarding: integer("completedOnboarding", { mode: "boolean" }).notNull().default(false),
    locale: text("locale"),
    timeFormat: integer("timeFormat").default(12),
    twoFactorSecret: text("twoFactorSecret"),
    twoFactorEnabled: integer("twoFactorEnabled", { mode: "boolean" }).notNull().default(false),
    backupCodes: text("backupCodes"),
    identityProvider: text("identityProvider", { enum: identityProviderValues }).notNull().default("CAL"),
    identityProviderId: text("identityProviderId"),
    invitedTo: integer("invitedTo"),
    brandColor: text("brandColor"),
    darkBrandColor: text("darkBrandColor"),
    allowDynamicBooking: integer("allowDynamicBooking", { mode: "boolean" }).default(true),
    allowSEOIndexing: integer("allowSEOIndexing", { mode: "boolean" }).default(true),
    receiveMonthlyDigestEmail: integer("receiveMonthlyDigestEmail", { mode: "boolean" }).default(true),
    requiresBookerEmailVerification: integer("requiresBookerEmailVerification", { mode: "boolean" }).default(
      false
    ),
    metadata: text("metadata", { mode: "json" }).$type<JsonValue>(),
    verified: integer("verified", { mode: "boolean" }).default(false),
    role: text("role", { enum: userPermissionRoleValues }).notNull().default("USER"),
    organizationId: integer("organizationId").references((): AnySQLiteColumn => team.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    // Better Auth's admin plugin: why and until when a user is locked (its `banned` is `locked`).
    banReason: text("banReason"),
    banExpires: integer("banExpires", { mode: "timestamp_ms" }),
    movedToProfileId: integer("movedToProfileId")
      .unique("users_movedToProfileId_key")
      .references((): AnySQLiteColumn => profile.id, { onDelete: "set null", onUpdate: "cascade" }),
    isPlatformManaged: integer("isPlatformManaged", { mode: "boolean" }).notNull().default(false),
    smsLockState: text("smsLockState", { enum: sMSLockStateValues }).notNull().default("UNLOCKED"),
    smsLockReviewedByAdmin: integer("smsLockReviewedByAdmin", { mode: "boolean" }).notNull().default(false),
    referralLinkId: text("referralLinkId"),
    creationSource: text("creationSource", { enum: creationSourceValues }),
    autoOptInFeatures: integer("autoOptInFeatures", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("users_username_idx").on(t.username),
    index("users_emailVerified_idx").on(t.emailVerified),
    index("users_identityProvider_idx").on(t.identityProvider),
    index("users_identityProviderId_idx").on(t.identityProviderId),
    uniqueIndex("users_email_key").on(t.email),
    uniqueIndex("users_email_username_key").on(t.email, t.username),
    uniqueIndex("users_username_organizationId_key").on(t.username, t.organizationId),
    uniqueIndex("users_movedToProfileId_key").on(t.movedToProfileId),
  ]
);

export const notificationsSubscriptions = sqliteTable(
  "NotificationsSubscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    subscription: text("subscription").notNull(),
  },
  (t) => [index("NotificationsSubscriptions_userId_subscription_idx").on(t.userId, t.subscription)]
);

export const profile = sqliteTable(
  "Profile",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: text("uid").notNull(),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    organizationId: integer("organizationId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    username: text("username").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("Profile_uid_idx").on(t.uid),
    index("Profile_userId_idx").on(t.userId),
    index("Profile_organizationId_idx").on(t.organizationId),
    uniqueIndex("Profile_userId_organizationId_key").on(t.userId, t.organizationId),
    uniqueIndex("Profile_username_organizationId_key").on(t.username, t.organizationId),
  ]
);

export const team = sqliteTable(
  "Team",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug"),
    logoUrl: text("logoUrl"),
    calVideoLogo: text("calVideoLogo"),
    appLogo: text("appLogo"),
    appIconLogo: text("appIconLogo"),
    bio: text("bio"),
    hideBranding: integer("hideBranding", { mode: "boolean" }).notNull().default(false),
    hideTeamProfileLink: integer("hideTeamProfileLink", { mode: "boolean" }).notNull().default(false),
    isPrivate: integer("isPrivate", { mode: "boolean" }).notNull().default(false),
    hideBookATeamMember: integer("hideBookATeamMember", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    metadata: text("metadata", { mode: "json" }).$type<JsonValue>(),
    theme: text("theme"),
    rrResetInterval: text("rrResetInterval", { enum: rRResetIntervalValues }).default("MONTH"),
    rrTimestampBasis: text("rrTimestampBasis", { enum: rRTimestampBasisValues })
      .notNull()
      .default("CREATED_AT"),
    brandColor: text("brandColor"),
    darkBrandColor: text("darkBrandColor"),
    bannerUrl: text("bannerUrl"),
    parentId: integer("parentId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    timeFormat: integer("timeFormat"),
    timeZone: text("timeZone").notNull().default("Europe/London"),
    weekStart: text("weekStart").notNull().default("Sunday"),
    isOrganization: integer("isOrganization", { mode: "boolean" }).notNull().default(false),
    pendingPayment: integer("pendingPayment", { mode: "boolean" }).notNull().default(false),
    isPlatform: integer("isPlatform", { mode: "boolean" }).notNull().default(false),
    createdByOAuthClientId: text("createdByOAuthClientId").references(
      (): AnySQLiteColumn => platformOAuthClient.id,
      { onDelete: "cascade", onUpdate: "cascade" }
    ),
    smsLockState: text("smsLockState", { enum: sMSLockStateValues }).notNull().default("UNLOCKED"),
    smsLockReviewedByAdmin: integer("smsLockReviewedByAdmin", { mode: "boolean" }).notNull().default(false),
    bookingLimits: text("bookingLimits", { mode: "json" }).$type<JsonValue>(),
    includeManagedEventsInLimits: integer("includeManagedEventsInLimits", { mode: "boolean" })
      .notNull()
      .default(false),
    autoOptInFeatures: integer("autoOptInFeatures", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("Team_parentId_idx").on(t.parentId),
    uniqueIndex("Team_slug_parentId_key").on(t.slug, t.parentId),
  ]
);

export const creditBalance = sqliteTable("CreditBalance", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  teamId: integer("teamId")
    .unique("CreditBalance_teamId_key")
    .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
  userId: integer("userId")
    .unique("CreditBalance_userId_key")
    .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  additionalCredits: integer("additionalCredits").notNull().default(0),
  limitReachedAt: integer("limitReachedAt", { mode: "timestamp_ms" }),
  warningSentAt: integer("warningSentAt", { mode: "timestamp_ms" }),
});

export const creditPurchaseLog = sqliteTable("CreditPurchaseLog", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  creditBalanceId: text("creditBalanceId")
    .notNull()
    .references((): AnySQLiteColumn => creditBalance.id, { onDelete: "cascade", onUpdate: "cascade" }),
  credits: integer("credits").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const creditExpenseLog = sqliteTable("CreditExpenseLog", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  creditBalanceId: text("creditBalanceId")
    .notNull()
    .references((): AnySQLiteColumn => creditBalance.id, { onDelete: "cascade", onUpdate: "cascade" }),
  bookingUid: text("bookingUid").references((): AnySQLiteColumn => booking.uid, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  credits: integer("credits"),
  creditType: text("creditType", { enum: creditTypeValues }).notNull(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  smsSid: text("smsSid"),
  smsSegments: integer("smsSegments"),
  phoneNumber: text("phoneNumber"),
  email: text("email"),
  callDuration: integer("callDuration"),
  creditFor: text("creditFor", { enum: creditUsageTypeValues }),
  externalRef: text("externalRef").unique("CreditExpenseLog_externalRef_key"),
});

export const organizationSettings = sqliteTable("OrganizationSettings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organizationId")
    .notNull()
    .unique("OrganizationSettings_organizationId_key")
    .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
  isOrganizationConfigured: integer("isOrganizationConfigured", { mode: "boolean" }).notNull().default(false),
  isOrganizationVerified: integer("isOrganizationVerified", { mode: "boolean" }).notNull().default(false),
  orgAutoAcceptEmail: text("orgAutoAcceptEmail").notNull(),
  lockEventTypeCreationForUsers: integer("lockEventTypeCreationForUsers", { mode: "boolean" })
    .notNull()
    .default(false),
  adminGetsNoSlotsNotification: integer("adminGetsNoSlotsNotification", { mode: "boolean" })
    .notNull()
    .default(false),
  isAdminReviewed: integer("isAdminReviewed", { mode: "boolean" }).notNull().default(false),
  isAdminAPIEnabled: integer("isAdminAPIEnabled", { mode: "boolean" }).notNull().default(false),
  allowSEOIndexing: integer("allowSEOIndexing", { mode: "boolean" }).notNull().default(false),
  orgProfileRedirectsToVerifiedDomain: integer("orgProfileRedirectsToVerifiedDomain", { mode: "boolean" })
    .notNull()
    .default(false),
  disablePhoneOnlySMSNotifications: integer("disablePhoneOnlySMSNotifications", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAutofillOnBookingPage: integer("disableAutofillOnBookingPage", { mode: "boolean" })
    .notNull()
    .default(false),
  orgAutoJoinOnSignup: integer("orgAutoJoinOnSignup", { mode: "boolean" }).notNull().default(true),
  disableAttendeeConfirmationEmail: integer("disableAttendeeConfirmationEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeCancellationEmail: integer("disableAttendeeCancellationEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeRescheduledEmail: integer("disableAttendeeRescheduledEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeRequestEmail: integer("disableAttendeeRequestEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeReassignedEmail: integer("disableAttendeeReassignedEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeAwaitingPaymentEmail: integer("disableAttendeeAwaitingPaymentEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeRescheduleRequestEmail: integer("disableAttendeeRescheduleRequestEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeLocationChangeEmail: integer("disableAttendeeLocationChangeEmail", { mode: "boolean" })
    .notNull()
    .default(false),
  disableAttendeeNewEventEmail: integer("disableAttendeeNewEventEmail", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const membership = sqliteTable(
  "Membership",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    accepted: integer("accepted", { mode: "boolean" }).notNull().default(false),
    role: text("role", { enum: membershipRoleValues }).notNull(),
    customRoleId: text("customRoleId").references((): AnySQLiteColumn => role.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("Membership_teamId_idx").on(t.teamId),
    index("Membership_userId_idx").on(t.userId),
    index("Membership_accepted_idx").on(t.accepted),
    index("Membership_role_idx").on(t.role),
    index("Membership_customRoleId_idx").on(t.customRoleId),
    uniqueIndex("Membership_userId_teamId_key").on(t.userId, t.teamId),
  ]
);

export const verificationToken = sqliteTable(
  "VerificationToken",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique("VerificationToken_token_key"),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    expiresInDays: integer("expiresInDays"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    secondaryEmailId: integer("secondaryEmailId").references((): AnySQLiteColumn => secondaryEmail.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    index("VerificationToken_token_idx").on(t.token),
    index("VerificationToken_teamId_idx").on(t.teamId),
    index("VerificationToken_secondaryEmailId_idx").on(t.secondaryEmailId),
    uniqueIndex("VerificationToken_identifier_token_key").on(t.identifier, t.token),
  ]
);

export const instantMeetingToken = sqliteTable(
  "InstantMeetingToken",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull().unique("InstantMeetingToken_token_key"),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    bookingId: integer("bookingId")
      .unique("InstantMeetingToken_bookingId_key")
      .references((): AnySQLiteColumn => booking.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [index("InstantMeetingToken_token_idx").on(t.token)]
);

export const bookingReference = sqliteTable(
  "BookingReference",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    uid: text("uid").notNull(),
    meetingId: text("meetingId"),
    thirdPartyRecurringEventId: text("thirdPartyRecurringEventId"),
    meetingPassword: text("meetingPassword"),
    meetingUrl: text("meetingUrl"),
    bookingId: integer("bookingId").references((): AnySQLiteColumn => booking.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    externalCalendarId: text("externalCalendarId"),
    deleted: integer("deleted", { mode: "boolean" }),
    credentialId: integer("credentialId").references((): AnySQLiteColumn => credential.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    delegationCredentialId: text("delegationCredentialId").references(
      (): AnySQLiteColumn => delegationCredential.id,
      { onDelete: "set null", onUpdate: "cascade" }
    ),
  },
  (t) => [
    index("BookingReference_bookingId_idx").on(t.bookingId),
    index("BookingReference_type_idx").on(t.type),
    index("BookingReference_uid_idx").on(t.uid),
  ]
);

export const attendee = sqliteTable(
  "Attendee",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    timeZone: text("timeZone").notNull(),
    phoneNumber: text("phoneNumber"),
    locale: text("locale").default("en"),
    bookingId: integer("bookingId").references((): AnySQLiteColumn => booking.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    noShow: integer("noShow", { mode: "boolean" }).default(false),
  },
  (t) => [
    index("Attendee_email_idx").on(t.email),
    index("Attendee_bookingId_idx").on(t.bookingId),
    index("Attendee_email_bookingId_idx").on(t.email, t.bookingId),
  ]
);

export const booking = sqliteTable(
  "Booking",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: text("uid").notNull().unique("Booking_uid_key"),
    idempotencyKey: text("idempotencyKey").unique("Booking_idempotencyKey_key"),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    userPrimaryEmail: text("userPrimaryEmail"),
    eventTypeId: integer("eventTypeId").references((): AnySQLiteColumn => eventType.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    customInputs: text("customInputs", { mode: "json" }).$type<JsonValue>(),
    responses: text("responses", { mode: "json" }).$type<JsonValue>(),
    startTime: integer("startTime", { mode: "timestamp_ms" }).notNull(),
    endTime: integer("endTime", { mode: "timestamp_ms" }).notNull(),
    location: text("location"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    status: text("status", { enum: bookingStatusValues }).notNull().default("ACCEPTED"),
    paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    destinationCalendarId: integer("destinationCalendarId").references(
      (): AnySQLiteColumn => destinationCalendar.id,
      { onDelete: "set null", onUpdate: "cascade" }
    ),
    cancellationReason: text("cancellationReason"),
    rejectionReason: text("rejectionReason"),
    reassignReason: text("reassignReason"),
    reassignById: integer("reassignById").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    dynamicEventSlugRef: text("dynamicEventSlugRef"),
    dynamicGroupSlugRef: text("dynamicGroupSlugRef"),
    rescheduled: integer("rescheduled", { mode: "boolean" }),
    fromReschedule: text("fromReschedule"),
    recurringEventId: text("recurringEventId"),
    smsReminderNumber: text("smsReminderNumber"),
    scheduledJobs: text("scheduledJobs", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    metadata: text("metadata", { mode: "json" }).$type<JsonValue>(),
    isRecorded: integer("isRecorded", { mode: "boolean" }).notNull().default(false),
    iCalUID: text("iCalUID").default(""),
    iCalSequence: integer("iCalSequence").notNull().default(0),
    rating: integer("rating"),
    ratingFeedback: text("ratingFeedback"),
    noShowHost: integer("noShowHost", { mode: "boolean" }).default(false),
    oneTimePassword: text("oneTimePassword")
      .unique("Booking_oneTimePassword_key")
      .$defaultFn(() => crypto.randomUUID()),
    cancelledBy: text("cancelledBy"),
    rescheduledBy: text("rescheduledBy"),
    creationSource: text("creationSource", { enum: creationSourceValues }),
  },
  (t) => [
    index("Booking_eventTypeId_idx").on(t.eventTypeId),
    index("Booking_userId_idx").on(t.userId),
    index("Booking_destinationCalendarId_idx").on(t.destinationCalendarId),
    index("Booking_recurringEventId_idx").on(t.recurringEventId),
    index("Booking_uid_idx").on(t.uid),
    index("Booking_status_idx").on(t.status),
    index("Booking_startTime_endTime_status_idx").on(t.startTime, t.endTime, t.status),
    index("Booking_fromReschedule_idx").on(t.fromReschedule),
    index("Booking_userId_endTime_idx").on(t.userId, t.endTime),
    index("Booking_userId_status_startTime_idx").on(t.userId, t.status, t.startTime),
    index("Booking_eventTypeId_status_idx").on(t.eventTypeId, t.status),
    index("Booking_userId_createdAt_idx").on(t.userId, t.createdAt),
  ]
);

export const tracking = sqliteTable(
  "Tracking",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("bookingId")
      .notNull()
      .unique("Tracking_bookingId_key")
      .references((): AnySQLiteColumn => booking.id, { onDelete: "cascade", onUpdate: "cascade" }),
    utm_source: text("utm_source"),
    utm_medium: text("utm_medium"),
    utm_campaign: text("utm_campaign"),
    utm_term: text("utm_term"),
    utm_content: text("utm_content"),
  },
  (t) => [uniqueIndex("Tracking_bookingId_key").on(t.bookingId)]
);

export const schedule = sqliteTable(
  "Schedule",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    timeZone: text("timeZone"),
  },
  (t) => [index("Schedule_userId_idx").on(t.userId)]
);

export const availability = sqliteTable(
  "Availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    eventTypeId: integer("eventTypeId").references((): AnySQLiteColumn => eventType.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    days: text("days", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .$defaultFn(() => []),
    startTime: integer("startTime", { mode: "timestamp_ms" }).notNull(),
    endTime: integer("endTime", { mode: "timestamp_ms" }).notNull(),
    date: integer("date", { mode: "timestamp_ms" }),
    scheduleId: integer("scheduleId").references((): AnySQLiteColumn => schedule.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    index("Availability_userId_idx").on(t.userId),
    index("Availability_eventTypeId_idx").on(t.eventTypeId),
    index("Availability_scheduleId_idx").on(t.scheduleId),
  ]
);

export const selectedCalendar = sqliteTable(
  "SelectedCalendar",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    integration: text("integration").notNull(),
    externalId: text("externalId").notNull(),
    credentialId: integer("credentialId").references((): AnySQLiteColumn => credential.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    googleChannelId: text("googleChannelId"),
    googleChannelKind: text("googleChannelKind"),
    googleChannelResourceId: text("googleChannelResourceId"),
    googleChannelResourceUri: text("googleChannelResourceUri"),
    googleChannelExpiration: text("googleChannelExpiration"),
    channelId: text("channelId"),
    channelKind: text("channelKind"),
    channelResourceId: text("channelResourceId"),
    channelResourceUri: text("channelResourceUri"),
    channelExpiration: integer("channelExpiration", { mode: "timestamp_ms" }),
    syncSubscribedAt: integer("syncSubscribedAt", { mode: "timestamp_ms" }),
    syncSubscribedErrorAt: integer("syncSubscribedErrorAt", { mode: "timestamp_ms" }),
    syncSubscribedErrorCount: integer("syncSubscribedErrorCount").notNull().default(0),
    syncToken: text("syncToken"),
    syncedAt: integer("syncedAt", { mode: "timestamp_ms" }),
    syncErrorAt: integer("syncErrorAt", { mode: "timestamp_ms" }),
    syncErrorCount: integer("syncErrorCount").default(0),
    delegationCredentialId: text("delegationCredentialId").references(
      (): AnySQLiteColumn => delegationCredential.id,
      { onDelete: "cascade", onUpdate: "cascade" }
    ),
    error: text("error"),
    lastErrorAt: integer("lastErrorAt", { mode: "timestamp_ms" }),
    watchAttempts: integer("watchAttempts").notNull().default(0),
    unwatchAttempts: integer("unwatchAttempts").notNull().default(0),
    maxAttempts: integer("maxAttempts").notNull().default(3),
    eventTypeId: integer("eventTypeId").references((): AnySQLiteColumn => eventType.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    index("SelectedCalendar_userId_idx").on(t.userId),
    index("SelectedCalendar_externalId_idx").on(t.externalId),
    index("SelectedCalendar_eventTypeId_idx").on(t.eventTypeId),
    index("SelectedCalendar_credentialId_idx").on(t.credentialId),
    index("SelectedCalendar_channelId_idx").on(t.channelId),
    index("SelectedCalendar_watch_idx").on(
      t.integration,
      t.googleChannelExpiration,
      t.error,
      t.watchAttempts,
      t.maxAttempts
    ),
    index("SelectedCalendar_unwatch_idx").on(
      t.integration,
      t.googleChannelExpiration,
      t.error,
      t.unwatchAttempts,
      t.maxAttempts
    ),
    uniqueIndex("SelectedCalendar_userId_integration_externalId_eventTypeId_key").on(
      t.userId,
      t.integration,
      t.externalId,
      t.eventTypeId
    ),
    uniqueIndex("SelectedCalendar_googleChannelId_eventTypeId_key").on(t.googleChannelId, t.eventTypeId),
  ]
);

export const eventTypeCustomInput = sqliteTable(
  "EventTypeCustomInput",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventTypeId: integer("eventTypeId")
      .notNull()
      .references((): AnySQLiteColumn => eventType.id, { onDelete: "cascade", onUpdate: "cascade" }),
    label: text("label").notNull(),
    type: text("type", { enum: eventTypeCustomInputTypeValues }).notNull(),
    options: text("options", { mode: "json" }).$type<JsonValue>(),
    required: integer("required", { mode: "boolean" }).notNull(),
    placeholder: text("placeholder").notNull().default(""),
  },
  (t) => [index("EventTypeCustomInput_eventTypeId_idx").on(t.eventTypeId)]
);

export const resetPasswordRequest = sqliteTable("ResetPasswordRequest", {
  id: text("id").primaryKey().$defaultFn(cuid),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  email: text("email").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const reminderMail = sqliteTable(
  "ReminderMail",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    referenceId: integer("referenceId").notNull(),
    reminderType: text("reminderType", { enum: reminderTypeValues }).notNull(),
    elapsedMinutes: integer("elapsedMinutes").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("ReminderMail_referenceId_idx").on(t.referenceId),
    index("ReminderMail_reminderType_idx").on(t.reminderType),
  ]
);

export const payment = sqliteTable(
  "Payment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: text("uid").notNull().unique("Payment_uid_key"),
    appId: text("appId").references((): AnySQLiteColumn => app.slug, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    bookingId: integer("bookingId")
      .notNull()
      .references((): AnySQLiteColumn => booking.id, { onDelete: "cascade", onUpdate: "cascade" }),
    amount: integer("amount").notNull(),
    fee: integer("fee").notNull(),
    currency: text("currency").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    refunded: integer("refunded", { mode: "boolean" }).notNull(),
    data: text("data", { mode: "json" }).$type<JsonValue>().notNull(),
    externalId: text("externalId").notNull().unique("Payment_externalId_key"),
    paymentOption: text("paymentOption", { enum: paymentOptionValues }).default("ON_BOOKING"),
  },
  (t) => [index("Payment_bookingId_idx").on(t.bookingId), index("Payment_externalId_idx").on(t.externalId)]
);

export const webhook = sqliteTable(
  "Webhook",
  {
    id: text("id").primaryKey(),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    eventTypeId: integer("eventTypeId").references((): AnySQLiteColumn => eventType.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    platformOAuthClientId: text("platformOAuthClientId").references(
      (): AnySQLiteColumn => platformOAuthClient.id,
      { onDelete: "cascade", onUpdate: "cascade" }
    ),
    subscriberUrl: text("subscriberUrl").notNull(),
    payloadTemplate: text("payloadTemplate"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    eventTriggers: text("eventTriggers", { mode: "json" })
      .$type<WebhookTriggerEvents[]>()
      .notNull()
      .$defaultFn(() => []),
    appId: text("appId").references((): AnySQLiteColumn => app.slug, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    secret: text("secret"),
    platform: integer("platform", { mode: "boolean" }).notNull().default(false),
    time: integer("time"),
    timeUnit: text("timeUnit", { enum: timeUnitValues }),
    version: text("version").notNull().default("2021-10-20"),
  },
  (t) => [
    index("Webhook_active_idx").on(t.active),
    uniqueIndex("Webhook_userId_subscriberUrl_key").on(t.userId, t.subscriberUrl),
    uniqueIndex("Webhook_platformOAuthClientId_subscriberUrl_key").on(
      t.platformOAuthClientId,
      t.subscriberUrl
    ),
  ]
);

// Better Auth `apiKey` plugin (@better-auth/api-key), replacing Cal's ApiKey shape. `key` holds
// base64url(SHA-256) of the secret after "cal_", which is the same digest Cal stored as hex in
// hashedKey, so the data import can carry existing keys over. referenceId is the owner's user id;
// a trigger in the migration removes keys with their user, since it can't be a foreign key.
export const apiKey = sqliteTable(
  "ApiKey",
  {
    // Serial like every Better Auth table here (advanced.database.generateId = "serial").
    id: integer("id").primaryKey({ autoIncrement: true }),
    configId: text("configId").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    referenceId: text("referenceId").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull().unique("ApiKey_key_key"),
    refillInterval: integer("refillInterval"),
    refillAmount: integer("refillAmount"),
    lastRefillAt: integer("lastRefillAt", { mode: "timestamp_ms" }),
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    rateLimitEnabled: integer("rateLimitEnabled", { mode: "boolean" }).default(true),
    rateLimitTimeWindow: integer("rateLimitTimeWindow"),
    rateLimitMax: integer("rateLimitMax"),
    requestCount: integer("requestCount").default(0),
    remaining: integer("remaining"),
    lastRequest: integer("lastRequest", { mode: "timestamp_ms" }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (t) => [index("ApiKey_referenceId_idx").on(t.referenceId), index("ApiKey_configId_idx").on(t.configId)]
);

/** Better Auth's organization invitations; Cal sent team invites as VerificationTokens instead. */
export const teamInvitation = sqliteTable(
  "TeamInvitation",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: membershipRoleValues }).notNull(),
    status: text("status").notNull().default("pending"),
    inviterId: integer("inviterId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("TeamInvitation_teamId_idx").on(t.teamId), index("TeamInvitation_email_idx").on(t.email)]
);

export const rateLimit = sqliteTable(
  "RateLimit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    apiKeyId: integer("apiKeyId")
      .notNull()
      .references((): AnySQLiteColumn => apiKey.id, { onDelete: "cascade", onUpdate: "cascade" }),
    ttl: integer("ttl").notNull(),
    limit: integer("limit").notNull(),
    blockDuration: integer("blockDuration").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [index("RateLimit_apiKeyId_idx").on(t.apiKeyId)]
);

export const hashedLink = sqliteTable(
  "HashedLink",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    link: text("link").notNull().unique("HashedLink_link_key"),
    eventTypeId: integer("eventTypeId")
      .notNull()
      .references((): AnySQLiteColumn => eventType.id, { onDelete: "cascade", onUpdate: "cascade" }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    maxUsageCount: integer("maxUsageCount").notNull().default(1),
    usageCount: integer("usageCount").notNull().default(0),
  },
  (t) => [index("HashedLink_eventTypeId_idx").on(t.eventTypeId)]
);

// Better Auth `account`: one row per sign-in method. Email/password logins are the
// `credential` provider and keep their hash in `password` (this replaces UserPassword).
export const account = sqliteTable(
  "Account",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    providerId: text("providerId").notNull(),
    accountId: text("accountId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("Account_userId_idx").on(t.userId),
    uniqueIndex("Account_providerId_accountId_key").on(t.providerId, t.accountId),
  ]
);

// Better Auth `session`.
export const session = sqliteTable(
  "Session",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull().unique("Session_token_key"),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    /** Better Auth's organization plugin: the team the user last switched to. */
    activeOrganizationId: integer("activeOrganizationId"),
    /** The admin acting as this session's user (Better Auth's admin plugin). */
    impersonatedBy: integer("impersonatedBy").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [index("Session_userId_idx").on(t.userId)]
);

// Better Auth `verification`: short-lived tokens for its own flows (password reset, OAuth state).
// Cal's VerificationToken stays for team invites and secondary emails.
export const verification = sqliteTable(
  "Verification",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [index("Verification_identifier_idx").on(t.identifier)]
);

// Better Auth `twoFactor` plugin. Replaces users.twoFactorSecret/backupCodes, which Cal encrypted
// with CALENDSO_ENCRYPTION_KEY; the data import re-encrypts them into this table.
export const twoFactor = sqliteTable(
  "TwoFactor",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backupCodes").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(true),
    failedVerificationCount: integer("failedVerificationCount").notNull().default(0),
    lockedUntil: integer("lockedUntil", { mode: "timestamp_ms" }),
  },
  (t) => [index("TwoFactor_userId_idx").on(t.userId), index("TwoFactor_secret_idx").on(t.secret)]
);

export const app = sqliteTable(
  "App",
  {
    slug: text("slug").primaryKey(),
    dirName: text("dirName").notNull().unique("App_dirName_key"),
    keys: text("keys", { mode: "json" }).$type<JsonValue>(),
    categories: text("categories", { mode: "json" })
      .$type<AppCategories[]>()
      .notNull()
      .$defaultFn(() => []),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("App_enabled_idx").on(t.enabled)]
);

export const feedback = sqliteTable(
  "Feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: integer("date", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    rating: text("rating").notNull(),
    comment: text("comment"),
  },
  (t) => [index("Feedback_userId_idx").on(t.userId), index("Feedback_rating_idx").on(t.rating)]
);

export const deployment = sqliteTable("Deployment", {
  id: integer("id").primaryKey().default(1),
  logo: text("logo"),
  theme: text("theme", { mode: "json" }).$type<JsonValue>(),
  licenseKey: text("licenseKey"),
  signatureTokenEncrypted: text("signatureTokenEncrypted"),
  agreedLicenseAt: integer("agreedLicenseAt", { mode: "timestamp_ms" }),
});

export const webhookScheduledTriggers = sqliteTable("WebhookScheduledTriggers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobName: text("jobName"),
  subscriberUrl: text("subscriberUrl").notNull(),
  payload: text("payload").notNull(),
  startAfter: integer("startAfter", { mode: "timestamp_ms" }).notNull(),
  retryCount: integer("retryCount").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
  appId: text("appId"),
  webhookId: text("webhookId").references((): AnySQLiteColumn => webhook.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  bookingId: integer("bookingId").references((): AnySQLiteColumn => booking.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
});

export const bookingSeat = sqliteTable(
  "BookingSeat",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    referenceUid: text("referenceUid").notNull().unique("BookingSeat_referenceUid_key"),
    bookingId: integer("bookingId")
      .notNull()
      .references((): AnySQLiteColumn => booking.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attendeeId: integer("attendeeId")
      .notNull()
      .unique("BookingSeat_attendeeId_key")
      .references((): AnySQLiteColumn => attendee.id, { onDelete: "cascade", onUpdate: "cascade" }),
    data: text("data", { mode: "json" }).$type<JsonValue>(),
    metadata: text("metadata", { mode: "json" }).$type<JsonValue>(),
  },
  (t) => [
    index("BookingSeat_bookingId_idx").on(t.bookingId),
    index("BookingSeat_attendeeId_idx").on(t.attendeeId),
  ]
);

export const verifiedNumber = sqliteTable(
  "VerifiedNumber",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    phoneNumber: text("phoneNumber").notNull(),
  },
  (t) => [index("VerifiedNumber_userId_idx").on(t.userId), index("VerifiedNumber_teamId_idx").on(t.teamId)]
);

export const verifiedEmail = sqliteTable(
  "VerifiedEmail",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    email: text("email").notNull(),
  },
  (t) => [index("VerifiedEmail_userId_idx").on(t.userId), index("VerifiedEmail_teamId_idx").on(t.teamId)]
);

export const feature = sqliteTable(
  "Feature",
  {
    slug: text("slug").primaryKey(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    description: text("description"),
    type: text("type", { enum: featureTypeValues }).default("RELEASE"),
    stale: integer("stale", { mode: "boolean" }).default(false),
    lastUsedAt: integer("lastUsedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    updatedBy: integer("updatedBy"),
  },
  (t) => [index("Feature_enabled_idx").on(t.enabled), index("Feature_stale_idx").on(t.stale)]
);

export const userFeatures = sqliteTable(
  "UserFeatures",
  {
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    featureId: text("featureId")
      .notNull()
      .references((): AnySQLiteColumn => feature.slug, { onDelete: "cascade", onUpdate: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    assignedAt: integer("assignedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    assignedBy: text("assignedBy").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.featureId] }),
    index("UserFeatures_userId_featureId_idx").on(t.userId, t.featureId),
  ]
);

export const teamFeatures = sqliteTable(
  "TeamFeatures",
  {
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    featureId: text("featureId")
      .notNull()
      .references((): AnySQLiteColumn => feature.slug, { onDelete: "cascade", onUpdate: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    assignedAt: integer("assignedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    assignedBy: text("assignedBy").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.featureId] }),
    index("TeamFeatures_teamId_featureId_idx").on(t.teamId, t.featureId),
  ]
);

export const selectedSlots = sqliteTable(
  "SelectedSlots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventTypeId: integer("eventTypeId").notNull(),
    userId: integer("userId").notNull(),
    slotUtcStartDate: integer("slotUtcStartDate", { mode: "timestamp_ms" }).notNull(),
    slotUtcEndDate: integer("slotUtcEndDate", { mode: "timestamp_ms" }).notNull(),
    uid: text("uid").notNull(),
    releaseAt: integer("releaseAt", { mode: "timestamp_ms" }).notNull(),
    isSeat: integer("isSeat", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("SelectedSlots_userId_slotUtcStartDate_slotUtcEndDate_uid_key").on(
      t.userId,
      t.slotUtcStartDate,
      t.slotUtcEndDate,
      t.uid
    ),
  ]
);

export const oAuthClient = sqliteTable(
  "OAuthClient",
  {
    clientId: text("clientId").primaryKey(),
    redirectUri: text("redirectUri").notNull(),
    clientSecret: text("clientSecret"),
    clientType: text("clientType", { enum: oAuthClientTypeValues }).notNull().default("CONFIDENTIAL"),
    name: text("name").notNull(),
    purpose: text("purpose"),
    logo: text("logo"),
    websiteUrl: text("websiteUrl"),
    rejectionReason: text("rejectionReason"),
    isTrusted: integer("isTrusted", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: oAuthClientStatusValues }).notNull().default("APPROVED"),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("OAuthClient_userId_idx").on(t.userId)]
);

export const accessCode = sqliteTable("AccessCode", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  clientId: text("clientId").references((): AnySQLiteColumn => oAuthClient.clientId, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  scopes: text("scopes", { mode: "json" })
    .$type<AccessScope[]>()
    .notNull()
    .$defaultFn(() => []),
  userId: integer("userId").references((): AnySQLiteColumn => user.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  codeChallenge: text("codeChallenge"),
  codeChallengeMethod: text("codeChallengeMethod").default("S256"),
});

export const bookingDenormalized = sqliteTable(
  "BookingDenormalized",
  {
    id: integer("id").primaryKey(),
    uid: text("uid").notNull(),
    eventTypeId: integer("eventTypeId"),
    title: text("title").notNull(),
    description: text("description"),
    startTime: integer("startTime", { mode: "timestamp_ms" }).notNull(),
    endTime: integer("endTime", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
    location: text("location"),
    paid: integer("paid", { mode: "boolean" }).notNull(),
    status: text("status", { enum: bookingStatusValues }).notNull(),
    rescheduled: integer("rescheduled", { mode: "boolean" }),
    userId: integer("userId"),
    teamId: integer("teamId"),
    eventLength: integer("eventLength"),
    eventParentId: integer("eventParentId"),
    userEmail: text("userEmail"),
    userName: text("userName"),
    userUsername: text("userUsername"),
    ratingFeedback: text("ratingFeedback"),
    rating: integer("rating"),
    noShowHost: integer("noShowHost", { mode: "boolean" }),
    isTeamBooking: integer("isTeamBooking", { mode: "boolean" }).notNull(),
  },
  (t) => [
    index("BookingDenormalized_userId_idx").on(t.userId),
    index("BookingDenormalized_createdAt_idx").on(t.createdAt),
    index("BookingDenormalized_eventTypeId_idx").on(t.eventTypeId),
    index("BookingDenormalized_eventParentId_idx").on(t.eventParentId),
    index("BookingDenormalized_teamId_idx").on(t.teamId),
    index("BookingDenormalized_startTime_idx").on(t.startTime),
    index("BookingDenormalized_endTime_idx").on(t.endTime),
    index("BookingDenormalized_status_idx").on(t.status),
    index("BookingDenormalized_teamId_isTeamBooking_idx").on(t.teamId, t.isTeamBooking),
    index("BookingDenormalized_userId_isTeamBooking_idx").on(t.userId, t.isTeamBooking),
    index("BookingDenormalized_startTime_endTime_idx").on(t.startTime, t.endTime),
  ]
);

export const calendarCache = sqliteTable(
  "CalendarCache",
  {
    id: text("id").$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).$type<JsonValue>().notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    credentialId: integer("credentialId")
      .notNull()
      .references((): AnySQLiteColumn => credential.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: integer("userId"),
  },
  (t) => [
    primaryKey({ columns: [t.credentialId, t.key] }),
    index("CalendarCache_userId_key_idx").on(t.userId, t.key),
    uniqueIndex("CalendarCache_credentialId_key_key").on(t.credentialId, t.key),
  ]
);

export const tempOrgRedirect = sqliteTable(
  "TempOrgRedirect",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    from: text("from").notNull(),
    fromOrgId: integer("fromOrgId").notNull(),
    type: text("type", { enum: redirectTypeValues }).notNull(),
    toUrl: text("toUrl").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("TempOrgRedirect_from_type_fromOrgId_key").on(t.from, t.type, t.fromOrgId)]
);

export const avatar = sqliteTable(
  "avatars",
  {
    teamId: integer("teamId").notNull().default(0),
    userId: integer("userId").notNull().default(0),
    data: text("data").notNull(),
    objectKey: text("objectKey").notNull().unique("avatars_objectKey_key"),
    isBanner: integer("isBanner", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("avatars_teamId_userId_isBanner_key").on(t.teamId, t.userId, t.isBanner)]
);

export const outOfOfficeEntry = sqliteTable(
  "OutOfOfficeEntry",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique("OutOfOfficeEntry_uuid_key"),
    start: integer("start", { mode: "timestamp_ms" }).notNull(),
    end: integer("end", { mode: "timestamp_ms" }).notNull(),
    notes: text("notes"),
    showNotePublicly: integer("showNotePublicly", { mode: "boolean" }).notNull().default(false),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    toUserId: integer("toUserId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    reasonId: integer("reasonId").references((): AnySQLiteColumn => outOfOfficeReason.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("OutOfOfficeEntry_uuid_idx").on(t.uuid),
    index("OutOfOfficeEntry_userId_idx").on(t.userId),
    index("OutOfOfficeEntry_toUserId_idx").on(t.toUserId),
    index("OutOfOfficeEntry_start_end_idx").on(t.start, t.end),
  ]
);

export const outOfOfficeReason = sqliteTable("OutOfOfficeReason", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  emoji: text("emoji").notNull(),
  reason: text("reason").notNull().unique("OutOfOfficeReason_reason_key"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  userId: integer("userId").references((): AnySQLiteColumn => user.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
});

export const userHolidaySettings = sqliteTable("UserHolidaySettings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId")
    .notNull()
    .unique("UserHolidaySettings_userId_key")
    .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  countryCode: text("countryCode"),
  disabledIds: text("disabledIds", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const holidayCache = sqliteTable(
  "HolidayCache",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    countryCode: text("countryCode").notNull(),
    calendarId: text("calendarId").notNull(),
    eventId: text("eventId").notNull(),
    name: text("name").notNull(),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    year: integer("year").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("HolidayCache_countryCode_year_idx").on(t.countryCode, t.year),
    index("HolidayCache_countryCode_date_idx").on(t.countryCode, t.date),
    uniqueIndex("HolidayCache_countryCode_eventId_key").on(t.countryCode, t.eventId),
  ]
);

export const platformOAuthClient = sqliteTable("PlatformOAuthClient", {
  id: text("id").primaryKey().$defaultFn(cuid),
  name: text("name").notNull(),
  secret: text("secret").notNull(),
  permissions: integer("permissions").notNull(),
  logo: text("logo"),
  redirectUris: text("redirectUris", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  organizationId: integer("organizationId")
    .notNull()
    .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
  bookingRedirectUri: text("bookingRedirectUri"),
  bookingCancelRedirectUri: text("bookingCancelRedirectUri"),
  bookingRescheduleRedirectUri: text("bookingRescheduleRedirectUri"),
  areEmailsEnabled: integer("areEmailsEnabled", { mode: "boolean" }).notNull().default(false),
  areDefaultEventTypesEnabled: integer("areDefaultEventTypesEnabled", { mode: "boolean" })
    .notNull()
    .default(true),
  areCalendarEventsEnabled: integer("areCalendarEventsEnabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const platformAuthorizationToken = sqliteTable(
  "PlatformAuthorizationToken",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    platformOAuthClientId: text("platformOAuthClientId")
      .notNull()
      .references((): AnySQLiteColumn => platformOAuthClient.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("PlatformAuthorizationToken_userId_platformOAuthClientId_key").on(
      t.userId,
      t.platformOAuthClientId
    ),
  ]
);

export const accessToken = sqliteTable("AccessToken", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  secret: text("secret").notNull().unique("AccessToken_secret_key"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  platformOAuthClientId: text("platformOAuthClientId")
    .notNull()
    .references((): AnySQLiteColumn => platformOAuthClient.id, { onDelete: "cascade", onUpdate: "cascade" }),
  userId: integer("userId")
    .notNull()
    .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const refreshToken = sqliteTable("RefreshToken", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  secret: text("secret").notNull().unique("RefreshToken_secret_key"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  platformOAuthClientId: text("platformOAuthClientId")
    .notNull()
    .references((): AnySQLiteColumn => platformOAuthClient.id, { onDelete: "cascade", onUpdate: "cascade" }),
  userId: integer("userId")
    .notNull()
    .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const dSyncData = sqliteTable("DSyncData", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  directoryId: text("directoryId").notNull().unique("DSyncData_directoryId_key"),
  tenant: text("tenant").notNull(),
  organizationId: integer("organizationId")
    .unique("DSyncData_organizationId_key")
    .references((): AnySQLiteColumn => organizationSettings.organizationId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
});

export const dSyncTeamGroupMapping = sqliteTable(
  "DSyncTeamGroupMapping",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organizationId").notNull(),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    directoryId: text("directoryId")
      .notNull()
      .references((): AnySQLiteColumn => dSyncData.directoryId, { onDelete: "cascade", onUpdate: "cascade" }),
    groupName: text("groupName").notNull(),
  },
  (t) => [uniqueIndex("DSyncTeamGroupMapping_teamId_groupName_key").on(t.teamId, t.groupName)]
);

export const secondaryEmail = sqliteTable(
  "SecondaryEmail",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    email: text("email").notNull().unique("SecondaryEmail_email_key"),
    emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("SecondaryEmail_userId_idx").on(t.userId),
    index("SecondaryEmail_email_emailVerified_idx").on(t.email, t.emailVerified),
    uniqueIndex("SecondaryEmail_email_key").on(t.email),
    uniqueIndex("SecondaryEmail_userId_email_key").on(t.userId, t.email),
  ]
);

export const task = sqliteTable(
  "Task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    scheduledAt: integer("scheduledAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    succeededAt: integer("succeededAt", { mode: "timestamp_ms" }),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("maxAttempts").notNull().default(3),
    lastError: text("lastError"),
    lastFailedAttemptAt: integer("lastFailedAttemptAt", { mode: "timestamp_ms" }),
    referenceUid: text("referenceUid"),
  },
  (t) => [
    index("Task_succeededAt_idx").on(t.succeededAt),
    index("Task_scheduledAt_succeededAt_idx").on(t.scheduledAt, t.succeededAt),
    uniqueIndex("Task_referenceUid_type_key").on(t.referenceUid, t.type),
  ]
);

export const managedOrganization = sqliteTable(
  "ManagedOrganization",
  {
    managedOrganizationId: integer("managedOrganizationId")
      .notNull()
      .unique("ManagedOrganization_managedOrganizationId_key")
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    managerOrganizationId: integer("managerOrganizationId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("ManagedOrganization_managerOrganizationId_idx").on(t.managerOrganizationId),
    uniqueIndex("ManagedOrganization_managerOrganizationId_managedOrganizationId_key").on(
      t.managerOrganizationId,
      t.managedOrganizationId
    ),
  ]
);

export const platformBilling = sqliteTable("PlatformBilling", {
  id: integer("id")
    .primaryKey()
    .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
  customerId: text("customerId").notNull(),
  subscriptionId: text("subscriptionId"),
  priceId: text("priceId"),
  plan: text("plan").notNull().default("none"),
  billingCycleStart: integer("billingCycleStart"),
  billingCycleEnd: integer("billingCycleEnd"),
  overdue: integer("overdue", { mode: "boolean" }).default(false),
  managerBillingId: integer("managerBillingId").references((): AnySQLiteColumn => platformBilling.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

export const attributeOption = sqliteTable("AttributeOption", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  attributeId: text("attributeId")
    .notNull()
    .references((): AnySQLiteColumn => attribute.id, { onDelete: "cascade", onUpdate: "cascade" }),
  value: text("value").notNull(),
  slug: text("slug").notNull(),
  isGroup: integer("isGroup", { mode: "boolean" }).notNull().default(false),
  contains: text("contains", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
});

export const attribute = sqliteTable(
  "Attribute",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    type: text("type", { enum: attributeTypeValues }).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    usersCanEditRelation: integer("usersCanEditRelation", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    isWeightsEnabled: integer("isWeightsEnabled", { mode: "boolean" }).notNull().default(false),
    isLocked: integer("isLocked", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("Attribute_teamId_idx").on(t.teamId),
    uniqueIndex("Attribute_teamId_slug_key").on(t.teamId, t.slug),
  ]
);

export const attributeToUser = sqliteTable(
  "AttributeToUser",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: integer("memberId")
      .notNull()
      .references((): AnySQLiteColumn => membership.id, { onDelete: "cascade", onUpdate: "cascade" }),
    attributeOptionId: text("attributeOptionId")
      .notNull()
      .references((): AnySQLiteColumn => attributeOption.id, { onDelete: "cascade", onUpdate: "cascade" }),
    weight: integer("weight"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdById: integer("createdById").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdByDSyncId: text("createdByDSyncId").references((): AnySQLiteColumn => dSyncData.directoryId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    updatedById: integer("updatedById").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    updatedByDSyncId: text("updatedByDSyncId").references((): AnySQLiteColumn => dSyncData.directoryId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [uniqueIndex("AttributeToUser_memberId_attributeOptionId_key").on(t.memberId, t.attributeOptionId)]
);

export const assignmentReason = sqliteTable(
  "AssignmentReason",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    bookingId: integer("bookingId")
      .notNull()
      .references((): AnySQLiteColumn => booking.id, { onDelete: "cascade", onUpdate: "cascade" }),
    reasonEnum: text("reasonEnum", { enum: assignmentReasonEnumValues }).notNull(),
    reasonString: text("reasonString").notNull(),
  },
  (t) => [index("AssignmentReason_bookingId_idx").on(t.bookingId)]
);

export const delegationCredential = sqliteTable(
  "DelegationCredential",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspacePlatformId: integer("workspacePlatformId")
      .notNull()
      .references((): AnySQLiteColumn => workspacePlatform.id, { onDelete: "cascade", onUpdate: "cascade" }),
    serviceAccountKey: text("serviceAccountKey", { mode: "json" }).$type<JsonValue>().notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    lastEnabledAt: integer("lastEnabledAt", { mode: "timestamp_ms" }),
    lastDisabledAt: integer("lastDisabledAt", { mode: "timestamp_ms" }),
    organizationId: integer("organizationId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    domain: text("domain").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("DelegationCredential_enabled_idx").on(t.enabled),
    uniqueIndex("DelegationCredential_organizationId_domain_key").on(t.organizationId, t.domain),
  ]
);

export const workspacePlatform = sqliteTable(
  "WorkspacePlatform",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique("WorkspacePlatform_slug_key"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    defaultServiceAccountKey: text("defaultServiceAccountKey", { mode: "json" }).$type<JsonValue>().notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("WorkspacePlatform_slug_key").on(t.slug)]
);

export const eventTypeTranslation = sqliteTable(
  "EventTypeTranslation",
  {
    uid: text("uid").primaryKey().$defaultFn(cuid),
    eventTypeId: integer("eventTypeId")
      .notNull()
      .references((): AnySQLiteColumn => eventType.id, { onDelete: "cascade", onUpdate: "cascade" }),
    field: text("field", { enum: eventTypeAutoTranslatedFieldValues }).notNull(),
    sourceLocale: text("sourceLocale").notNull(),
    targetLocale: text("targetLocale").notNull(),
    translatedText: text("translatedText").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdBy: integer("createdBy")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    updatedBy: integer("updatedBy").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    index("EventTypeTranslation_eventTypeId_field_targetLocale_idx").on(
      t.eventTypeId,
      t.field,
      t.targetLocale
    ),
    uniqueIndex("EventTypeTranslation_eventTypeId_field_targetLocale_key").on(
      t.eventTypeId,
      t.field,
      t.targetLocale
    ),
  ]
);

export const watchlist = sqliteTable(
  "Watchlist",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: text("type", { enum: watchlistTypeValues }).notNull(),
    value: text("value").notNull(),
    description: text("description"),
    isGlobal: integer("isGlobal", { mode: "boolean" }).notNull().default(false),
    organizationId: integer("organizationId"),
    action: text("action", { enum: watchlistActionValues }).notNull().default("REPORT"),
    source: text("source", { enum: watchlistSourceValues }).notNull().default("MANUAL"),
    lastUpdatedAt: integer("lastUpdatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("Watchlist_isGlobal_action_organizationId_type_value_idx").on(
      t.isGlobal,
      t.action,
      t.organizationId,
      t.type,
      t.value
    ),
    uniqueIndex("Watchlist_type_value_organizationId_key").on(t.type, t.value, t.organizationId),
  ]
);

export const watchlistAudit = sqliteTable(
  "WatchlistAudit",
  {
    id: text("id").primaryKey().$defaultFn(uuidv7),
    type: text("type", { enum: watchlistTypeValues }).notNull(),
    value: text("value").notNull(),
    description: text("description"),
    action: text("action", { enum: watchlistActionValues }).notNull().default("REPORT"),
    changedAt: integer("changedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    changedByUserId: integer("changedByUserId"),
    watchlistId: text("watchlistId").references((): AnySQLiteColumn => watchlist.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [index("WatchlistAudit_watchlistId_changedAt_idx").on(t.watchlistId, t.changedAt)]
);

export const watchlistEventAudit = sqliteTable("WatchlistEventAudit", {
  id: text("id").primaryKey().$defaultFn(uuidv7),
  watchlistId: text("watchlistId").notNull(),
  eventTypeId: integer("eventTypeId").notNull(),
  actionTaken: text("actionTaken", { enum: watchlistActionValues }).notNull(),
  timestamp: integer("timestamp", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bookingReport = sqliteTable(
  "BookingReport",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingUid: text("bookingUid")
      .notNull()
      .unique("BookingReport_bookingUid_key")
      .references((): AnySQLiteColumn => booking.uid, { onDelete: "cascade", onUpdate: "cascade" }),
    bookerEmail: text("bookerEmail").notNull(),
    reportedById: integer("reportedById").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    organizationId: integer("organizationId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    reason: text("reason", { enum: bookingReportReasonValues }).notNull(),
    description: text("description"),
    cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    status: text("status", { enum: bookingReportStatusValues }).notNull().default("PENDING"),
    systemStatus: text("systemStatus", { enum: systemReportStatusValues }).notNull().default("PENDING"),
    watchlistId: text("watchlistId").references((): AnySQLiteColumn => watchlist.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    globalWatchlistId: text("globalWatchlistId").references((): AnySQLiteColumn => watchlist.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    index("BookingReport_bookerEmail_idx").on(t.bookerEmail),
    index("BookingReport_reportedById_idx").on(t.reportedById),
    index("BookingReport_organizationId_idx").on(t.organizationId),
    index("BookingReport_watchlistId_idx").on(t.watchlistId),
    index("BookingReport_globalWatchlistId_idx").on(t.globalWatchlistId),
    index("BookingReport_systemStatus_idx").on(t.systemStatus),
    index("BookingReport_createdAt_idx").on(t.createdAt),
  ]
);

export const wrongAssignmentReport = sqliteTable(
  "WrongAssignmentReport",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingUid: text("bookingUid")
      .notNull()
      .unique("WrongAssignmentReport_bookingUid_key")
      .references((): AnySQLiteColumn => booking.uid, { onDelete: "cascade", onUpdate: "cascade" }),
    reportedById: integer("reportedById").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    correctAssignee: text("correctAssignee"),
    additionalNotes: text("additionalNotes").notNull(),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: text("status", { enum: wrongAssignmentReportStatusValues }).notNull().default("PENDING"),
    reviewedById: integer("reviewedById").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    reviewedAt: integer("reviewedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("WrongAssignmentReport_reportedById_idx").on(t.reportedById),
    index("WrongAssignmentReport_teamId_idx").on(t.teamId),
    index("WrongAssignmentReport_status_idx").on(t.status),
    index("WrongAssignmentReport_reviewedById_idx").on(t.reviewedById),
    index("WrongAssignmentReport_createdAt_idx").on(t.createdAt),
    index("WrongAssignmentReport_teamId_status_createdAt_idx").on(t.teamId, t.status, t.createdAt),
  ]
);

export const organizationOnboarding = sqliteTable(
  "OrganizationOnboarding",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    createdById: integer("createdById")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    orgOwnerEmail: text("orgOwnerEmail").notNull().unique("OrganizationOnboarding_orgOwnerEmail_key"),
    error: text("error"),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    organizationId: integer("organizationId")
      .unique("OrganizationOnboarding_organizationId_key")
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    billingPeriod: text("billingPeriod", { enum: billingPeriodValues }).notNull(),
    pricePerSeat: real("pricePerSeat").notNull(),
    seats: integer("seats").notNull(),
    isPlatform: integer("isPlatform", { mode: "boolean" }).notNull().default(false),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    bio: text("bio"),
    brandColor: text("brandColor"),
    bannerUrl: text("bannerUrl"),
    isDomainConfigured: integer("isDomainConfigured", { mode: "boolean" }).notNull().default(false),
    stripeCustomerId: text("stripeCustomerId").unique("OrganizationOnboarding_stripeCustomerId_key"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    stripeSubscriptionItemId: text("stripeSubscriptionItemId"),
    invitedMembers: text("invitedMembers", { mode: "json" })
      .$type<JsonValue>()
      .notNull()
      .$defaultFn(() => []),
    teams: text("teams", { mode: "json" })
      .$type<JsonValue>()
      .notNull()
      .$defaultFn(() => []),
    isComplete: integer("isComplete", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("OrganizationOnboarding_orgOwnerEmail_idx").on(t.orgOwnerEmail),
    index("OrganizationOnboarding_stripeCustomerId_idx").on(t.stripeCustomerId),
  ]
);

export const internalNotePreset = sqliteTable(
  "InternalNotePreset",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    cancellationReason: text("cancellationReason"),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("InternalNotePreset_teamId_idx").on(t.teamId),
    uniqueIndex("InternalNotePreset_teamId_name_key").on(t.teamId, t.name),
  ]
);

export const filterSegment = sqliteTable(
  "FilterSegment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    tableIdentifier: text("tableIdentifier").notNull(),
    scope: text("scope", { enum: filterSegmentScopeValues }).notNull(),
    activeFilters: text("activeFilters", { mode: "json" }).$type<JsonValue>(),
    sorting: text("sorting", { mode: "json" }).$type<JsonValue>(),
    columnVisibility: text("columnVisibility", { mode: "json" }).$type<JsonValue>(),
    columnSizing: text("columnSizing", { mode: "json" }).$type<JsonValue>(),
    perPage: integer("perPage").notNull(),
    searchTerm: text("searchTerm"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    index("FilterSegment_scope_userId_tableIdentifier_idx").on(t.scope, t.userId, t.tableIdentifier),
    index("FilterSegment_scope_teamId_tableIdentifier_idx").on(t.scope, t.teamId, t.tableIdentifier),
  ]
);

export const userFilterSegmentPreference = sqliteTable(
  "UserFilterSegmentPreference",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tableIdentifier: text("tableIdentifier").notNull(),
    segmentId: integer("segmentId").references((): AnySQLiteColumn => filterSegment.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    systemSegmentId: text("systemSegmentId"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("UserFilterSegmentPreference_userId_idx").on(t.userId),
    index("UserFilterSegmentPreference_segmentId_idx").on(t.segmentId),
    uniqueIndex("UserFilterSegmentPreference_userId_tableIdentifier_key").on(t.userId, t.tableIdentifier),
  ]
);

export const bookingInternalNote = sqliteTable(
  "BookingInternalNote",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    notePresetId: integer("notePresetId").references((): AnySQLiteColumn => internalNotePreset.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    text: text("text"),
    bookingId: integer("bookingId")
      .notNull()
      .references((): AnySQLiteColumn => booking.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdById: integer("createdById")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("BookingInternalNote_bookingId_idx").on(t.bookingId),
    uniqueIndex("BookingInternalNote_bookingId_notePresetId_key").on(t.bookingId, t.notePresetId),
  ]
);

export const role = sqliteTable(
  "Role",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    name: text("name").notNull(),
    color: text("color"),
    description: text("description"),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    type: text("type", { enum: roleTypeValues }).notNull().default("CUSTOM"),
  },
  (t) => [index("Role_teamId_idx").on(t.teamId), uniqueIndex("Role_name_teamId_key").on(t.name, t.teamId)]
);

export const rolePermission = sqliteTable(
  "RolePermission",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roleId: text("roleId")
      .notNull()
      .references((): AnySQLiteColumn => role.id, { onDelete: "cascade", onUpdate: "cascade" }),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("RolePermission_roleId_idx").on(t.roleId),
    index("RolePermission_action_idx").on(t.action),
    uniqueIndex("RolePermission_roleId_resource_action_key").on(t.roleId, t.resource, t.action),
  ]
);

export const auditActor = sqliteTable(
  "AuditActor",
  {
    id: text("id").primaryKey().$defaultFn(uuidv7),
    type: text("type", { enum: auditActorTypeValues }).notNull(),
    userUuid: text("userUuid").unique("AuditActor_userUuid_key"),
    attendeeId: integer("attendeeId").unique("AuditActor_attendeeId_key"),
    credentialId: integer("credentialId").unique("AuditActor_credentialId_key"),
    email: text("email").unique("AuditActor_email_key"),
    phone: text("phone").unique("AuditActor_phone_key"),
    name: text("name"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("AuditActor_email_idx").on(t.email),
    index("AuditActor_userUuid_idx").on(t.userUuid),
    index("AuditActor_attendeeId_idx").on(t.attendeeId),
    index("AuditActor_credentialId_idx").on(t.credentialId),
    uniqueIndex("AuditActor_userUuid_key").on(t.userUuid),
    uniqueIndex("AuditActor_attendeeId_key").on(t.attendeeId),
    uniqueIndex("AuditActor_credentialId_key").on(t.credentialId),
    uniqueIndex("AuditActor_email_key").on(t.email),
    uniqueIndex("AuditActor_phone_key").on(t.phone),
  ]
);

export const bookingAudit = sqliteTable(
  "BookingAudit",
  {
    id: text("id").primaryKey().$defaultFn(uuidv7),
    bookingUid: text("bookingUid").notNull(),
    actorId: text("actorId")
      .notNull()
      .references((): AnySQLiteColumn => auditActor.id, { onDelete: "restrict", onUpdate: "cascade" }),
    type: text("type", { enum: bookingAuditTypeValues }).notNull(),
    action: text("action", { enum: bookingAuditActionValues }).notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    source: text("source", { enum: bookingAuditSourceValues }).notNull(),
    operationId: text("operationId").notNull(),
    data: text("data", { mode: "json" }).$type<JsonValue>(),
    context: text("context", { mode: "json" }).$type<JsonValue>(),
  },
  (t) => [
    index("BookingAudit_actorId_idx").on(t.actorId),
    index("BookingAudit_bookingUid_idx").on(t.bookingUid),
    index("BookingAudit_timestamp_idx").on(t.timestamp),
    index("BookingAudit_operationId_idx").on(t.operationId),
  ]
);

export const agent = sqliteTable(
  "Agent",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    providerAgentId: text("providerAgentId").notNull().unique("Agent_providerAgentId_key"),
    inboundEventTypeId: integer("inboundEventTypeId"),
    outboundEventTypeId: integer("outboundEventTypeId"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("Agent_userId_idx").on(t.userId),
    index("Agent_teamId_idx").on(t.teamId),
    index("Agent_inboundEventTypeId_idx").on(t.inboundEventTypeId),
    index("Agent_outboundEventTypeId_idx").on(t.outboundEventTypeId),
  ]
);

export const calAiPhoneNumber = sqliteTable(
  "CalAiPhoneNumber",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").references((): AnySQLiteColumn => user.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    teamId: integer("teamId").references((): AnySQLiteColumn => team.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    phoneNumber: text("phoneNumber").notNull().unique("CalAiPhoneNumber_phoneNumber_key"),
    provider: text("provider").notNull(),
    providerPhoneNumberId: text("providerPhoneNumberId").unique("CalAiPhoneNumber_providerPhoneNumberId_key"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId").unique("CalAiPhoneNumber_stripeSubscriptionId_key"),
    subscriptionStatus: text("subscriptionStatus", { enum: phoneNumberSubscriptionStatusValues }),
    inboundAgentId: text("inboundAgentId").references((): AnySQLiteColumn => agent.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    outboundAgentId: text("outboundAgentId").references((): AnySQLiteColumn => agent.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (t) => [
    index("CalAiPhoneNumber_userId_idx").on(t.userId),
    index("CalAiPhoneNumber_teamId_idx").on(t.teamId),
    index("CalAiPhoneNumber_inboundAgentId_idx").on(t.inboundAgentId),
    index("CalAiPhoneNumber_outboundAgentId_idx").on(t.outboundAgentId),
  ]
);

export const teamBilling = sqliteTable("TeamBilling", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  teamId: integer("teamId")
    .notNull()
    .unique("TeamBilling_teamId_key")
    .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
  subscriptionId: text("subscriptionId").notNull().unique("TeamBilling_subscriptionId_key"),
  subscriptionItemId: text("subscriptionItemId").notNull(),
  customerId: text("customerId").notNull(),
  status: text("status").notNull(),
  planName: text("planName").notNull(),
  subscriptionStart: integer("subscriptionStart", { mode: "timestamp_ms" }),
  subscriptionTrialEnd: integer("subscriptionTrialEnd", { mode: "timestamp_ms" }),
  subscriptionEnd: integer("subscriptionEnd", { mode: "timestamp_ms" }),
  billingPeriod: text("billingPeriod", { enum: billingPeriodValues }),
  billingMode: text("billingMode", { enum: billingModeValues }).notNull().default("SEATS"),
  pricePerSeat: integer("pricePerSeat"),
  paidSeats: integer("paidSeats"),
  highWaterMark: integer("highWaterMark"),
  highWaterMarkPeriodStart: integer("highWaterMarkPeriodStart", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const organizationBilling = sqliteTable("OrganizationBilling", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  teamId: integer("teamId")
    .notNull()
    .unique("OrganizationBilling_teamId_key")
    .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
  subscriptionId: text("subscriptionId").notNull().unique("OrganizationBilling_subscriptionId_key"),
  subscriptionItemId: text("subscriptionItemId").notNull(),
  customerId: text("customerId").notNull(),
  status: text("status").notNull(),
  planName: text("planName").notNull(),
  subscriptionStart: integer("subscriptionStart", { mode: "timestamp_ms" }),
  subscriptionTrialEnd: integer("subscriptionTrialEnd", { mode: "timestamp_ms" }),
  subscriptionEnd: integer("subscriptionEnd", { mode: "timestamp_ms" }),
  billingPeriod: text("billingPeriod", { enum: billingPeriodValues }),
  billingMode: text("billingMode", { enum: billingModeValues }).notNull().default("SEATS"),
  pricePerSeat: integer("pricePerSeat"),
  paidSeats: integer("paidSeats"),
  highWaterMark: integer("highWaterMark"),
  highWaterMarkPeriodStart: integer("highWaterMarkPeriodStart", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const seatChangeLog = sqliteTable(
  "SeatChangeLog",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    changeType: text("changeType", { enum: seatChangeTypeValues }).notNull(),
    seatCount: integer("seatCount").notNull(),
    userId: integer("userId"),
    triggeredBy: integer("triggeredBy"),
    changeDate: integer("changeDate", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    monthKey: text("monthKey").notNull(),
    operationId: text("operationId"),
    processedInProrationId: text("processedInProrationId").references(
      (): AnySQLiteColumn => monthlyProration.id,
      { onDelete: "set null", onUpdate: "cascade" }
    ),
    metadata: text("metadata", { mode: "json" }).$type<JsonValue>(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    teamBillingId: text("teamBillingId").references((): AnySQLiteColumn => teamBilling.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    organizationBillingId: text("organizationBillingId").references(
      (): AnySQLiteColumn => organizationBilling.id,
      { onDelete: "set null", onUpdate: "cascade" }
    ),
  },
  (t) => [
    index("SeatChangeLog_teamId_monthKey_idx").on(t.teamId, t.monthKey),
    index("SeatChangeLog_teamId_processedInProrationId_idx").on(t.teamId, t.processedInProrationId),
    index("SeatChangeLog_monthKey_idx").on(t.monthKey),
    uniqueIndex("SeatChangeLog_teamId_operationId_key").on(t.teamId, t.operationId),
  ]
);

export const monthlyProration = sqliteTable(
  "MonthlyProration",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: integer("teamId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    monthKey: text("monthKey").notNull(),
    periodStart: integer("periodStart", { mode: "timestamp_ms" }).notNull(),
    periodEnd: integer("periodEnd", { mode: "timestamp_ms" }).notNull(),
    seatsAtStart: integer("seatsAtStart").notNull(),
    seatsAdded: integer("seatsAdded").notNull(),
    seatsRemoved: integer("seatsRemoved").notNull(),
    netSeatIncrease: integer("netSeatIncrease").notNull(),
    seatsAtEnd: integer("seatsAtEnd").notNull(),
    subscriptionId: text("subscriptionId").notNull(),
    subscriptionItemId: text("subscriptionItemId").notNull(),
    customerId: text("customerId").notNull(),
    subscriptionStart: integer("subscriptionStart", { mode: "timestamp_ms" }).notNull(),
    subscriptionEnd: integer("subscriptionEnd", { mode: "timestamp_ms" }).notNull(),
    remainingDays: integer("remainingDays").notNull(),
    pricePerSeat: integer("pricePerSeat").notNull(),
    proratedAmount: integer("proratedAmount").notNull(),
    invoiceItemId: text("invoiceItemId"),
    invoiceId: text("invoiceId"),
    invoiceUrl: text("invoiceUrl"),
    status: text("status", { enum: prorationStatusValues }).notNull().default("PENDING"),
    chargedAt: integer("chargedAt", { mode: "timestamp_ms" }),
    failedAt: integer("failedAt", { mode: "timestamp_ms" }),
    failureReason: text("failureReason"),
    retryCount: integer("retryCount").notNull().default(0),
    metadata: text("metadata", { mode: "json" }).$type<JsonValue>(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    teamBillingId: text("teamBillingId").references((): AnySQLiteColumn => teamBilling.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    organizationBillingId: text("organizationBillingId").references(
      (): AnySQLiteColumn => organizationBilling.id,
      { onDelete: "set null", onUpdate: "cascade" }
    ),
  },
  (t) => [
    index("MonthlyProration_monthKey_status_idx").on(t.monthKey, t.status),
    index("MonthlyProration_status_idx").on(t.status),
    index("MonthlyProration_teamId_idx").on(t.teamId),
    uniqueIndex("MonthlyProration_teamId_monthKey_key").on(t.teamId, t.monthKey),
  ]
);

export const calendarCacheEvent = sqliteTable(
  "CalendarCacheEvent",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    selectedCalendarId: text("selectedCalendarId")
      .notNull()
      .references((): AnySQLiteColumn => selectedCalendar.id, { onDelete: "cascade", onUpdate: "cascade" }),
    externalId: text("externalId").notNull(),
    externalEtag: text("externalEtag").notNull(),
    iCalUID: text("iCalUID"),
    iCalSequence: integer("iCalSequence").notNull().default(0),
    summary: text("summary"),
    description: text("description"),
    location: text("location"),
    start: integer("start", { mode: "timestamp_ms" }).notNull(),
    end: integer("end", { mode: "timestamp_ms" }).notNull(),
    isAllDay: integer("isAllDay", { mode: "boolean" }).notNull().default(false),
    timeZone: text("timeZone"),
    status: text("status", { enum: calendarCacheEventStatusValues }).notNull().default("confirmed"),
    recurringEventId: text("recurringEventId"),
    originalStartTime: integer("originalStartTime", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    externalCreatedAt: integer("externalCreatedAt", { mode: "timestamp_ms" }),
    externalUpdatedAt: integer("externalUpdatedAt", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("CalendarCacheEvent_start_end_status_idx").on(t.start, t.end, t.status),
    index("CalendarCacheEvent_selectedCalendarId_iCalUID_idx").on(t.selectedCalendarId, t.iCalUID),
    uniqueIndex("CalendarCacheEvent_selectedCalendarId_externalId_key").on(
      t.selectedCalendarId,
      t.externalId
    ),
  ]
);

export const integrationAttributeSync = sqliteTable(
  "IntegrationAttributeSync",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: integer("organizationId")
      .notNull()
      .references((): AnySQLiteColumn => team.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    integration: text("integration").notNull(),
    credentialId: integer("credentialId").references((): AnySQLiteColumn => credential.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("IntegrationAttributeSync_organizationId_idx").on(t.organizationId),
    index("IntegrationAttributeSync_credentialId_idx").on(t.credentialId),
  ]
);

export const attributeSyncRule = sqliteTable("AttributeSyncRule", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  integrationAttributeSyncId: text("integrationAttributeSyncId")
    .notNull()
    .unique("AttributeSyncRule_integrationAttributeSyncId_key")
    .references((): AnySQLiteColumn => integrationAttributeSync.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  rule: text("rule", { mode: "json" }).$type<JsonValue>().notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const attributeSyncFieldMapping = sqliteTable(
  "AttributeSyncFieldMapping",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    integrationFieldName: text("integrationFieldName").notNull(),
    attributeId: text("attributeId")
      .notNull()
      .references((): AnySQLiteColumn => attribute.id, { onDelete: "cascade", onUpdate: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    integrationAttributeSyncId: text("integrationAttributeSyncId")
      .notNull()
      .references((): AnySQLiteColumn => integrationAttributeSync.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("AttributeSyncFieldMapping_integrationAttributeSyncId_idx").on(t.integrationAttributeSyncId),
    uniqueIndex("AttributeSyncFieldMapping_integrationAttributeSyncId_attributeId_key").on(
      t.integrationAttributeSyncId,
      t.attributeId
    ),
  ]
);

export type Host = typeof host.$inferSelect;
export type NewHost = typeof host.$inferInsert;
export type HostGroup = typeof hostGroup.$inferSelect;
export type NewHostGroup = typeof hostGroup.$inferInsert;
export type HostLocation = typeof hostLocation.$inferSelect;
export type NewHostLocation = typeof hostLocation.$inferInsert;
export type CalVideoSettings = typeof calVideoSettings.$inferSelect;
export type NewCalVideoSettings = typeof calVideoSettings.$inferInsert;
export type VideoCallGuest = typeof videoCallGuest.$inferSelect;
export type NewVideoCallGuest = typeof videoCallGuest.$inferInsert;
export type EventType = typeof eventType.$inferSelect;
export type NewEventType = typeof eventType.$inferInsert;
export type Credential = typeof credential.$inferSelect;
export type NewCredential = typeof credential.$inferInsert;
export type DestinationCalendar = typeof destinationCalendar.$inferSelect;
export type NewDestinationCalendar = typeof destinationCalendar.$inferInsert;
export type TravelSchedule = typeof travelSchedule.$inferSelect;
export type NewTravelSchedule = typeof travelSchedule.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type NotificationsSubscriptions = typeof notificationsSubscriptions.$inferSelect;
export type NewNotificationsSubscriptions = typeof notificationsSubscriptions.$inferInsert;
export type Profile = typeof profile.$inferSelect;
export type NewProfile = typeof profile.$inferInsert;
export type Team = typeof team.$inferSelect;
export type NewTeam = typeof team.$inferInsert;
export type CreditBalance = typeof creditBalance.$inferSelect;
export type NewCreditBalance = typeof creditBalance.$inferInsert;
export type CreditPurchaseLog = typeof creditPurchaseLog.$inferSelect;
export type NewCreditPurchaseLog = typeof creditPurchaseLog.$inferInsert;
export type CreditExpenseLog = typeof creditExpenseLog.$inferSelect;
export type NewCreditExpenseLog = typeof creditExpenseLog.$inferInsert;
export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert;
export type Membership = typeof membership.$inferSelect;
export type NewMembership = typeof membership.$inferInsert;
export type VerificationToken = typeof verificationToken.$inferSelect;
export type NewVerificationToken = typeof verificationToken.$inferInsert;
export type InstantMeetingToken = typeof instantMeetingToken.$inferSelect;
export type NewInstantMeetingToken = typeof instantMeetingToken.$inferInsert;
export type BookingReference = typeof bookingReference.$inferSelect;
export type NewBookingReference = typeof bookingReference.$inferInsert;
export type Attendee = typeof attendee.$inferSelect;
export type NewAttendee = typeof attendee.$inferInsert;
export type Booking = typeof booking.$inferSelect;
export type NewBooking = typeof booking.$inferInsert;
export type Tracking = typeof tracking.$inferSelect;
export type NewTracking = typeof tracking.$inferInsert;
export type Schedule = typeof schedule.$inferSelect;
export type NewSchedule = typeof schedule.$inferInsert;
export type Availability = typeof availability.$inferSelect;
export type NewAvailability = typeof availability.$inferInsert;
export type SelectedCalendar = typeof selectedCalendar.$inferSelect;
export type NewSelectedCalendar = typeof selectedCalendar.$inferInsert;
export type EventTypeCustomInput = typeof eventTypeCustomInput.$inferSelect;
export type NewEventTypeCustomInput = typeof eventTypeCustomInput.$inferInsert;
export type ResetPasswordRequest = typeof resetPasswordRequest.$inferSelect;
export type NewResetPasswordRequest = typeof resetPasswordRequest.$inferInsert;
export type ReminderMail = typeof reminderMail.$inferSelect;
export type NewReminderMail = typeof reminderMail.$inferInsert;
export type Payment = typeof payment.$inferSelect;
export type NewPayment = typeof payment.$inferInsert;
export type Webhook = typeof webhook.$inferSelect;
export type NewWebhook = typeof webhook.$inferInsert;
export type ApiKey = typeof apiKey.$inferSelect;
export type NewApiKey = typeof apiKey.$inferInsert;
export type RateLimit = typeof rateLimit.$inferSelect;
export type NewRateLimit = typeof rateLimit.$inferInsert;
export type HashedLink = typeof hashedLink.$inferSelect;
export type NewHashedLink = typeof hashedLink.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type App = typeof app.$inferSelect;
export type NewApp = typeof app.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type Deployment = typeof deployment.$inferSelect;
export type NewDeployment = typeof deployment.$inferInsert;
export type WebhookScheduledTriggers = typeof webhookScheduledTriggers.$inferSelect;
export type NewWebhookScheduledTriggers = typeof webhookScheduledTriggers.$inferInsert;
export type BookingSeat = typeof bookingSeat.$inferSelect;
export type NewBookingSeat = typeof bookingSeat.$inferInsert;
export type VerifiedNumber = typeof verifiedNumber.$inferSelect;
export type NewVerifiedNumber = typeof verifiedNumber.$inferInsert;
export type VerifiedEmail = typeof verifiedEmail.$inferSelect;
export type NewVerifiedEmail = typeof verifiedEmail.$inferInsert;
export type Feature = typeof feature.$inferSelect;
export type NewFeature = typeof feature.$inferInsert;
export type UserFeatures = typeof userFeatures.$inferSelect;
export type NewUserFeatures = typeof userFeatures.$inferInsert;
export type TeamFeatures = typeof teamFeatures.$inferSelect;
export type NewTeamFeatures = typeof teamFeatures.$inferInsert;
export type SelectedSlots = typeof selectedSlots.$inferSelect;
export type NewSelectedSlots = typeof selectedSlots.$inferInsert;
export type OAuthClient = typeof oAuthClient.$inferSelect;
export type NewOAuthClient = typeof oAuthClient.$inferInsert;
export type AccessCode = typeof accessCode.$inferSelect;
export type NewAccessCode = typeof accessCode.$inferInsert;
export type BookingDenormalized = typeof bookingDenormalized.$inferSelect;
export type NewBookingDenormalized = typeof bookingDenormalized.$inferInsert;
export type CalendarCache = typeof calendarCache.$inferSelect;
export type NewCalendarCache = typeof calendarCache.$inferInsert;
export type TempOrgRedirect = typeof tempOrgRedirect.$inferSelect;
export type NewTempOrgRedirect = typeof tempOrgRedirect.$inferInsert;
export type Avatar = typeof avatar.$inferSelect;
export type NewAvatar = typeof avatar.$inferInsert;
export type OutOfOfficeEntry = typeof outOfOfficeEntry.$inferSelect;
export type NewOutOfOfficeEntry = typeof outOfOfficeEntry.$inferInsert;
export type OutOfOfficeReason = typeof outOfOfficeReason.$inferSelect;
export type NewOutOfOfficeReason = typeof outOfOfficeReason.$inferInsert;
export type UserHolidaySettings = typeof userHolidaySettings.$inferSelect;
export type NewUserHolidaySettings = typeof userHolidaySettings.$inferInsert;
export type HolidayCache = typeof holidayCache.$inferSelect;
export type NewHolidayCache = typeof holidayCache.$inferInsert;
export type PlatformOAuthClient = typeof platformOAuthClient.$inferSelect;
export type NewPlatformOAuthClient = typeof platformOAuthClient.$inferInsert;
export type PlatformAuthorizationToken = typeof platformAuthorizationToken.$inferSelect;
export type NewPlatformAuthorizationToken = typeof platformAuthorizationToken.$inferInsert;
export type AccessToken = typeof accessToken.$inferSelect;
export type NewAccessToken = typeof accessToken.$inferInsert;
export type RefreshToken = typeof refreshToken.$inferSelect;
export type NewRefreshToken = typeof refreshToken.$inferInsert;
export type DSyncData = typeof dSyncData.$inferSelect;
export type NewDSyncData = typeof dSyncData.$inferInsert;
export type DSyncTeamGroupMapping = typeof dSyncTeamGroupMapping.$inferSelect;
export type NewDSyncTeamGroupMapping = typeof dSyncTeamGroupMapping.$inferInsert;
export type SecondaryEmail = typeof secondaryEmail.$inferSelect;
export type NewSecondaryEmail = typeof secondaryEmail.$inferInsert;
export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;
export type ManagedOrganization = typeof managedOrganization.$inferSelect;
export type NewManagedOrganization = typeof managedOrganization.$inferInsert;
export type PlatformBilling = typeof platformBilling.$inferSelect;
export type NewPlatformBilling = typeof platformBilling.$inferInsert;
export type AttributeOption = typeof attributeOption.$inferSelect;
export type NewAttributeOption = typeof attributeOption.$inferInsert;
export type Attribute = typeof attribute.$inferSelect;
export type NewAttribute = typeof attribute.$inferInsert;
export type AttributeToUser = typeof attributeToUser.$inferSelect;
export type NewAttributeToUser = typeof attributeToUser.$inferInsert;
export type AssignmentReason = typeof assignmentReason.$inferSelect;
export type NewAssignmentReason = typeof assignmentReason.$inferInsert;
export type DelegationCredential = typeof delegationCredential.$inferSelect;
export type NewDelegationCredential = typeof delegationCredential.$inferInsert;
export type WorkspacePlatform = typeof workspacePlatform.$inferSelect;
export type NewWorkspacePlatform = typeof workspacePlatform.$inferInsert;
export type EventTypeTranslation = typeof eventTypeTranslation.$inferSelect;
export type NewEventTypeTranslation = typeof eventTypeTranslation.$inferInsert;
export type Watchlist = typeof watchlist.$inferSelect;
export type NewWatchlist = typeof watchlist.$inferInsert;
export type WatchlistAudit = typeof watchlistAudit.$inferSelect;
export type NewWatchlistAudit = typeof watchlistAudit.$inferInsert;
export type WatchlistEventAudit = typeof watchlistEventAudit.$inferSelect;
export type NewWatchlistEventAudit = typeof watchlistEventAudit.$inferInsert;
export type BookingReport = typeof bookingReport.$inferSelect;
export type NewBookingReport = typeof bookingReport.$inferInsert;
export type WrongAssignmentReport = typeof wrongAssignmentReport.$inferSelect;
export type NewWrongAssignmentReport = typeof wrongAssignmentReport.$inferInsert;
export type OrganizationOnboarding = typeof organizationOnboarding.$inferSelect;
export type NewOrganizationOnboarding = typeof organizationOnboarding.$inferInsert;
export type InternalNotePreset = typeof internalNotePreset.$inferSelect;
export type NewInternalNotePreset = typeof internalNotePreset.$inferInsert;
export type FilterSegment = typeof filterSegment.$inferSelect;
export type NewFilterSegment = typeof filterSegment.$inferInsert;
export type UserFilterSegmentPreference = typeof userFilterSegmentPreference.$inferSelect;
export type NewUserFilterSegmentPreference = typeof userFilterSegmentPreference.$inferInsert;
export type BookingInternalNote = typeof bookingInternalNote.$inferSelect;
export type NewBookingInternalNote = typeof bookingInternalNote.$inferInsert;
export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;
export type RolePermission = typeof rolePermission.$inferSelect;
export type NewRolePermission = typeof rolePermission.$inferInsert;
export type AuditActor = typeof auditActor.$inferSelect;
export type NewAuditActor = typeof auditActor.$inferInsert;
export type BookingAudit = typeof bookingAudit.$inferSelect;
export type NewBookingAudit = typeof bookingAudit.$inferInsert;
export type Agent = typeof agent.$inferSelect;
export type NewAgent = typeof agent.$inferInsert;
export type CalAiPhoneNumber = typeof calAiPhoneNumber.$inferSelect;
export type NewCalAiPhoneNumber = typeof calAiPhoneNumber.$inferInsert;
export type TeamBilling = typeof teamBilling.$inferSelect;
export type NewTeamBilling = typeof teamBilling.$inferInsert;
export type OrganizationBilling = typeof organizationBilling.$inferSelect;
export type NewOrganizationBilling = typeof organizationBilling.$inferInsert;
export type SeatChangeLog = typeof seatChangeLog.$inferSelect;
export type NewSeatChangeLog = typeof seatChangeLog.$inferInsert;
export type MonthlyProration = typeof monthlyProration.$inferSelect;
export type NewMonthlyProration = typeof monthlyProration.$inferInsert;
export type CalendarCacheEvent = typeof calendarCacheEvent.$inferSelect;
export type NewCalendarCacheEvent = typeof calendarCacheEvent.$inferInsert;
export type IntegrationAttributeSync = typeof integrationAttributeSync.$inferSelect;
export type NewIntegrationAttributeSync = typeof integrationAttributeSync.$inferInsert;
export type AttributeSyncRule = typeof attributeSyncRule.$inferSelect;
export type NewAttributeSyncRule = typeof attributeSyncRule.$inferInsert;
export type AttributeSyncFieldMapping = typeof attributeSyncFieldMapping.$inferSelect;
export type NewAttributeSyncFieldMapping = typeof attributeSyncFieldMapping.$inferInsert;
