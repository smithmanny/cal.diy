// Generated from packages/prisma/schema.prisma, then maintained by hand.
import { relations } from "drizzle-orm";
import * as t from "./schema";

export const hostRelations = relations(t.host, ({ one }) => ({
  user: one(t.user, { fields: [t.host.userId], references: [t.user.id], relationName: "HostToUser" }),
  eventType: one(t.eventType, {
    fields: [t.host.eventTypeId],
    references: [t.eventType.id],
    relationName: "EventTypeToHost",
  }),
  schedule: one(t.schedule, {
    fields: [t.host.scheduleId],
    references: [t.schedule.id],
    relationName: "HostToSchedule",
  }),
  group: one(t.hostGroup, {
    fields: [t.host.groupId],
    references: [t.hostGroup.id],
    relationName: "HostToHostGroup",
  }),
  member: one(t.membership, {
    fields: [t.host.memberId],
    references: [t.membership.id],
    relationName: "HostToMembership",
  }),
  location: one(t.hostLocation),
}));

export const hostGroupRelations = relations(t.hostGroup, ({ one, many }) => ({
  hosts: many(t.host, { relationName: "HostToHostGroup" }),
  eventType: one(t.eventType, {
    fields: [t.hostGroup.eventTypeId],
    references: [t.eventType.id],
    relationName: "EventTypeToHostGroup",
  }),
}));

export const hostLocationRelations = relations(t.hostLocation, ({ one }) => ({
  host: one(t.host, {
    fields: [t.hostLocation.userId, t.hostLocation.eventTypeId],
    references: [t.host.userId, t.host.eventTypeId],
    relationName: "HostToHostLocation",
  }),
  credential: one(t.credential, {
    fields: [t.hostLocation.credentialId],
    references: [t.credential.id],
    relationName: "CredentialToHostLocation",
  }),
}));

export const calVideoSettingsRelations = relations(t.calVideoSettings, ({ one }) => ({
  eventType: one(t.eventType, {
    fields: [t.calVideoSettings.eventTypeId],
    references: [t.eventType.id],
    relationName: "CalVideoSettingsToEventType",
  }),
}));

export const eventTypeRelations = relations(t.eventType, ({ one, many }) => ({
  hosts: many(t.host, { relationName: "EventTypeToHost" }),
  users: many(t.user, { relationName: "user_eventtype" }),
  owner: one(t.user, { fields: [t.eventType.userId], references: [t.user.id], relationName: "owner" }),
  profile: one(t.profile, {
    fields: [t.eventType.profileId],
    references: [t.profile.id],
    relationName: "EventTypeToProfile",
  }),
  team: one(t.team, {
    fields: [t.eventType.teamId],
    references: [t.team.id],
    relationName: "EventTypeToTeam",
  }),
  hashedLink: many(t.hashedLink, { relationName: "EventTypeToHashedLink" }),
  bookings: many(t.booking, { relationName: "BookingToEventType" }),
  availability: many(t.availability, { relationName: "AvailabilityToEventType" }),
  webhooks: many(t.webhook, { relationName: "EventTypeToWebhook" }),
  destinationCalendar: one(t.destinationCalendar),
  customInputs: many(t.eventTypeCustomInput, { relationName: "EventTypeToEventTypeCustomInput" }),
  parent: one(t.eventType, {
    fields: [t.eventType.parentId],
    references: [t.eventType.id],
    relationName: "managed_eventtype",
  }),
  children: many(t.eventType, { relationName: "managed_eventtype" }),
  schedule: one(t.schedule, {
    fields: [t.eventType.scheduleId],
    references: [t.schedule.id],
    relationName: "EventTypeToSchedule",
  }),
  instantMeetingSchedule: one(t.schedule, {
    fields: [t.eventType.instantMeetingScheduleId],
    references: [t.schedule.id],
    relationName: "InstantMeetingSchedule",
  }),
  fieldTranslations: many(t.eventTypeTranslation, { relationName: "EventTypeToEventTypeTranslation" }),
  selectedCalendars: many(t.selectedCalendar, { relationName: "EventTypeToSelectedCalendar" }),
  calVideoSettings: one(t.calVideoSettings),
  secondaryEmail: one(t.secondaryEmail, {
    fields: [t.eventType.secondaryEmailId],
    references: [t.secondaryEmail.id],
    relationName: "EventTypeToSecondaryEmail",
  }),
  restrictionSchedule: one(t.schedule, {
    fields: [t.eventType.restrictionScheduleId],
    references: [t.schedule.id],
    relationName: "restrictionSchedule",
  }),
  hostGroups: many(t.hostGroup, { relationName: "EventTypeToHostGroup" }),
}));

export const credentialRelations = relations(t.credential, ({ one, many }) => ({
  user: one(t.user, {
    fields: [t.credential.userId],
    references: [t.user.id],
    relationName: "CredentialToUser",
  }),
  team: one(t.team, {
    fields: [t.credential.teamId],
    references: [t.team.id],
    relationName: "CredentialToTeam",
  }),
  app: one(t.app, {
    fields: [t.credential.appId],
    references: [t.app.slug],
    relationName: "AppToCredential",
  }),
  destinationCalendars: many(t.destinationCalendar, { relationName: "CredentialToDestinationCalendar" }),
  selectedCalendars: many(t.selectedCalendar, { relationName: "CredentialToSelectedCalendar" }),
  CalendarCache: many(t.calendarCache, { relationName: "CalendarCacheToCredential" }),
  references: many(t.bookingReference, { relationName: "BookingReferenceToCredential" }),
  delegationCredential: one(t.delegationCredential, {
    fields: [t.credential.delegationCredentialId],
    references: [t.delegationCredential.id],
    relationName: "CredentialToDelegationCredential",
  }),
  integrationAttributeSyncs: many(t.integrationAttributeSync, {
    relationName: "CredentialToIntegrationAttributeSync",
  }),
  hostLocations: many(t.hostLocation, { relationName: "CredentialToHostLocation" }),
}));

export const destinationCalendarRelations = relations(t.destinationCalendar, ({ one, many }) => ({
  user: one(t.user, {
    fields: [t.destinationCalendar.userId],
    references: [t.user.id],
    relationName: "DestinationCalendarToUser",
  }),
  booking: many(t.booking, { relationName: "BookingToDestinationCalendar" }),
  eventType: one(t.eventType, {
    fields: [t.destinationCalendar.eventTypeId],
    references: [t.eventType.id],
    relationName: "DestinationCalendarToEventType",
  }),
  credential: one(t.credential, {
    fields: [t.destinationCalendar.credentialId],
    references: [t.credential.id],
    relationName: "CredentialToDestinationCalendar",
  }),
  delegationCredential: one(t.delegationCredential, {
    fields: [t.destinationCalendar.delegationCredentialId],
    references: [t.delegationCredential.id],
    relationName: "DelegationCredentialToDestinationCalendar",
  }),
}));

export const travelScheduleRelations = relations(t.travelSchedule, ({ one }) => ({
  user: one(t.user, {
    fields: [t.travelSchedule.userId],
    references: [t.user.id],
    relationName: "TravelScheduleToUser",
  }),
}));

export const userRelations = relations(t.user, ({ one, many }) => ({
  travelSchedules: many(t.travelSchedule, { relationName: "TravelScheduleToUser" }),
  eventTypes: many(t.eventType, { relationName: "user_eventtype" }),
  credentials: many(t.credential, { relationName: "CredentialToUser" }),
  teams: many(t.membership, { relationName: "MembershipToUser" }),
  bookings: many(t.booking, { relationName: "BookingToUser" }),
  schedules: many(t.schedule, { relationName: "ScheduleToUser" }),
  selectedCalendars: many(t.selectedCalendar, { relationName: "SelectedCalendarToUser" }),
  availability: many(t.availability, { relationName: "AvailabilityToUser" }),
  webhooks: many(t.webhook, { relationName: "UserToWebhook" }),
  destinationCalendar: one(t.destinationCalendar),
  apiKeys: many(t.apiKey, { relationName: "ApiKeyToUser" }),
  accounts: many(t.account, { relationName: "AccountToUser" }),
  sessions: many(t.session, { relationName: "SessionToUser" }),
  Feedback: many(t.feedback, { relationName: "FeedbackToUser" }),
  ownedEventTypes: many(t.eventType, { relationName: "owner" }),
  verifiedNumbers: many(t.verifiedNumber, { relationName: "UserToVerifiedNumber" }),
  verifiedEmails: many(t.verifiedEmail, { relationName: "UserToVerifiedEmail" }),
  hosts: many(t.host, { relationName: "HostToUser" }),
  organization: one(t.team, {
    fields: [t.user.organizationId],
    references: [t.team.id],
    relationName: "scope",
  }),
  accessCodes: many(t.accessCode, { relationName: "AccessCodeToUser" }),
  bookingRedirects: many(t.outOfOfficeEntry, { relationName: "OutOfOfficeEntryToUser" }),
  bookingRedirectsTo: many(t.outOfOfficeEntry, { relationName: "toUser" }),
  platformOAuthClients: many(t.platformOAuthClient, { relationName: "PlatformOAuthClientToUser" }),
  AccessToken: many(t.accessToken, { relationName: "AccessTokenToUser" }),
  RefreshToken: many(t.refreshToken, { relationName: "RefreshTokenToUser" }),
  PlatformAuthorizationToken: many(t.platformAuthorizationToken, {
    relationName: "PlatformAuthorizationTokenToUser",
  }),
  profiles: many(t.profile, { relationName: "ProfileToUser" }),
  movedToProfile: one(t.profile, {
    fields: [t.user.movedToProfileId],
    references: [t.profile.id],
    relationName: "moved_to_profile",
  }),
  secondaryEmails: many(t.secondaryEmail, { relationName: "SecondaryEmailToUser" }),
  OutOfOfficeReasons: many(t.outOfOfficeReason, { relationName: "OutOfOfficeReasonToUser" }),
  NotificationsSubscriptions: many(t.notificationsSubscriptions, {
    relationName: "NotificationsSubscriptionsToUser",
  }),
  features: many(t.userFeatures, { relationName: "UserToUserFeatures" }),
  reassignedBookings: many(t.booking, { relationName: "reassignByUser" }),
  createdAttributeToUsers: many(t.attributeToUser, { relationName: "createdBy" }),
  updatedAttributeToUsers: many(t.attributeToUser, { relationName: "updatedBy" }),
  createdTranslations: many(t.eventTypeTranslation, { relationName: "CreatedEventTypeTranslations" }),
  updatedTranslations: many(t.eventTypeTranslation, { relationName: "UpdatedEventTypeTranslations" }),
  reportedBookings: many(t.bookingReport, { relationName: "ReportedBy" }),
  wrongAssignmentReports: many(t.wrongAssignmentReport, { relationName: "WrongAssignmentReportedBy" }),
  reviewedWrongAssignmentReports: many(t.wrongAssignmentReport, {
    relationName: "WrongAssignmentReviewedBy",
  }),
  BookingInternalNote: many(t.bookingInternalNote, { relationName: "BookingInternalNoteToUser" }),
  createdOrganizationOnboardings: many(t.organizationOnboarding, {
    relationName: "CreatedOrganizationOnboardings",
  }),
  filterSegments: many(t.filterSegment, { relationName: "FilterSegmentToUser" }),
  filterSegmentPreferences: many(t.userFilterSegmentPreference, {
    relationName: "UserToUserFilterSegmentPreference",
  }),
  creditBalance: one(t.creditBalance),
  calAiPhoneNumbers: many(t.calAiPhoneNumber, { relationName: "CalAiPhoneNumberToUser" }),
  agents: many(t.agent, { relationName: "AgentToUser" }),
  oAuthClients: many(t.oAuthClient, { relationName: "OAuthClientToUser" }),
  holidaySettings: one(t.userHolidaySettings),
}));

export const notificationsSubscriptionsRelations = relations(t.notificationsSubscriptions, ({ one }) => ({
  user: one(t.user, {
    fields: [t.notificationsSubscriptions.userId],
    references: [t.user.id],
    relationName: "NotificationsSubscriptionsToUser",
  }),
}));

export const profileRelations = relations(t.profile, ({ one, many }) => ({
  user: one(t.user, { fields: [t.profile.userId], references: [t.user.id], relationName: "ProfileToUser" }),
  organization: one(t.team, {
    fields: [t.profile.organizationId],
    references: [t.team.id],
    relationName: "ProfileToTeam",
  }),
  eventTypes: many(t.eventType, { relationName: "EventTypeToProfile" }),
  movedFromUser: one(t.user),
}));

export const teamRelations = relations(t.team, ({ one, many }) => ({
  members: many(t.membership, { relationName: "MembershipToTeam" }),
  eventTypes: many(t.eventType, { relationName: "EventTypeToTeam" }),
  verifiedNumbers: many(t.verifiedNumber, { relationName: "TeamToVerifiedNumber" }),
  verifiedEmails: many(t.verifiedEmail, { relationName: "TeamToVerifiedEmail" }),
  parent: one(t.team, { fields: [t.team.parentId], references: [t.team.id], relationName: "organization" }),
  children: many(t.team, { relationName: "organization" }),
  orgUsers: many(t.user, { relationName: "scope" }),
  inviteTokens: many(t.verificationToken, { relationName: "TeamToVerificationToken" }),
  webhooks: many(t.webhook, { relationName: "TeamToWebhook" }),
  apiKeys: many(t.apiKey, { relationName: "ApiKeyToTeam" }),
  credentials: many(t.credential, { relationName: "CredentialToTeam" }),
  accessCodes: many(t.accessCode, { relationName: "AccessCodeToTeam" }),
  organizationSettings: one(t.organizationSettings),
  instantMeetingTokens: many(t.instantMeetingToken, { relationName: "InstantMeetingTokenToTeam" }),
  orgProfiles: many(t.profile, { relationName: "ProfileToTeam" }),
  dsyncTeamGroupMapping: many(t.dSyncTeamGroupMapping, { relationName: "DSyncTeamGroupMappingToTeam" }),
  platformOAuthClient: many(t.platformOAuthClient, { relationName: "PlatformOAuthClientToTeam" }),
  createdByOAuthClient: one(t.platformOAuthClient, {
    fields: [t.team.createdByOAuthClientId],
    references: [t.platformOAuthClient.id],
    relationName: "CreatedByOAuthClient",
  }),
  platformBilling: one(t.platformBilling),
  attributes: many(t.attribute, { relationName: "AttributeToTeam" }),
  delegationCredentials: many(t.delegationCredential, { relationName: "DelegationCredentialToTeam" }),
  roles: many(t.role, { relationName: "RoleToTeam" }),
  calAiPhoneNumbers: many(t.calAiPhoneNumber, { relationName: "CalAiPhoneNumberToTeam" }),
  agents: many(t.agent, { relationName: "AgentToTeam" }),
  bookingReports: many(t.bookingReport, { relationName: "BookingReportToTeam" }),
  wrongAssignmentReports: many(t.wrongAssignmentReport, { relationName: "TeamToWrongAssignmentReport" }),
  features: many(t.teamFeatures, { relationName: "TeamToTeamFeatures" }),
  internalNotePresets: many(t.internalNotePreset, { relationName: "InternalNotePresetToTeam" }),
  creditBalance: one(t.creditBalance),
  organizationOnboarding: one(t.organizationOnboarding),
  managedOrganization: one(t.managedOrganization),
  managedOrganizations: many(t.managedOrganization, { relationName: "ManagerOrganization" }),
  filterSegments: many(t.filterSegment, { relationName: "FilterSegmentToTeam" }),
  teamBilling: one(t.teamBilling),
  organizationBilling: one(t.organizationBilling),
  integrationAttributeSyncs: many(t.integrationAttributeSync, {
    relationName: "IntegrationAttributeSyncToTeam",
  }),
  seatChangeLogs: many(t.seatChangeLog, { relationName: "SeatChangeLogToTeam" }),
  monthlyProrations: many(t.monthlyProration, { relationName: "MonthlyProrationToTeam" }),
}));

export const creditBalanceRelations = relations(t.creditBalance, ({ one, many }) => ({
  team: one(t.team, {
    fields: [t.creditBalance.teamId],
    references: [t.team.id],
    relationName: "CreditBalanceToTeam",
  }),
  user: one(t.user, {
    fields: [t.creditBalance.userId],
    references: [t.user.id],
    relationName: "CreditBalanceToUser",
  }),
  expenseLogs: many(t.creditExpenseLog, { relationName: "CreditBalanceToCreditExpenseLog" }),
  purchaseLogs: many(t.creditPurchaseLog, { relationName: "CreditBalanceToCreditPurchaseLog" }),
}));

export const creditPurchaseLogRelations = relations(t.creditPurchaseLog, ({ one }) => ({
  creditBalance: one(t.creditBalance, {
    fields: [t.creditPurchaseLog.creditBalanceId],
    references: [t.creditBalance.id],
    relationName: "CreditBalanceToCreditPurchaseLog",
  }),
}));

export const creditExpenseLogRelations = relations(t.creditExpenseLog, ({ one }) => ({
  creditBalance: one(t.creditBalance, {
    fields: [t.creditExpenseLog.creditBalanceId],
    references: [t.creditBalance.id],
    relationName: "CreditBalanceToCreditExpenseLog",
  }),
  booking: one(t.booking, {
    fields: [t.creditExpenseLog.bookingUid],
    references: [t.booking.uid],
    relationName: "BookingToCreditExpenseLog",
  }),
}));

export const organizationSettingsRelations = relations(t.organizationSettings, ({ one }) => ({
  organization: one(t.team, {
    fields: [t.organizationSettings.organizationId],
    references: [t.team.id],
    relationName: "OrganizationSettingsToTeam",
  }),
  dSyncData: one(t.dSyncData),
}));

export const membershipRelations = relations(t.membership, ({ one, many }) => ({
  customRole: one(t.role, {
    fields: [t.membership.customRoleId],
    references: [t.role.id],
    relationName: "MembershipToRole",
  }),
  team: one(t.team, {
    fields: [t.membership.teamId],
    references: [t.team.id],
    relationName: "MembershipToTeam",
  }),
  user: one(t.user, {
    fields: [t.membership.userId],
    references: [t.user.id],
    relationName: "MembershipToUser",
  }),
  AttributeToUser: many(t.attributeToUser, { relationName: "AttributeToUserToMembership" }),
  Host: many(t.host, { relationName: "HostToMembership" }),
}));

export const verificationTokenRelations = relations(t.verificationToken, ({ one }) => ({
  team: one(t.team, {
    fields: [t.verificationToken.teamId],
    references: [t.team.id],
    relationName: "TeamToVerificationToken",
  }),
  secondaryEmail: one(t.secondaryEmail, {
    fields: [t.verificationToken.secondaryEmailId],
    references: [t.secondaryEmail.id],
    relationName: "SecondaryEmailToVerificationToken",
  }),
}));

export const instantMeetingTokenRelations = relations(t.instantMeetingToken, ({ one }) => ({
  team: one(t.team, {
    fields: [t.instantMeetingToken.teamId],
    references: [t.team.id],
    relationName: "InstantMeetingTokenToTeam",
  }),
  booking: one(t.booking, {
    fields: [t.instantMeetingToken.bookingId],
    references: [t.booking.id],
    relationName: "BookingToInstantMeetingToken",
  }),
}));

export const bookingReferenceRelations = relations(t.bookingReference, ({ one }) => ({
  booking: one(t.booking, {
    fields: [t.bookingReference.bookingId],
    references: [t.booking.id],
    relationName: "BookingToBookingReference",
  }),
  credential: one(t.credential, {
    fields: [t.bookingReference.credentialId],
    references: [t.credential.id],
    relationName: "BookingReferenceToCredential",
  }),
  delegationCredential: one(t.delegationCredential, {
    fields: [t.bookingReference.delegationCredentialId],
    references: [t.delegationCredential.id],
    relationName: "BookingReferenceToDelegationCredential",
  }),
}));

export const attendeeRelations = relations(t.attendee, ({ one }) => ({
  booking: one(t.booking, {
    fields: [t.attendee.bookingId],
    references: [t.booking.id],
    relationName: "AttendeeToBooking",
  }),
  bookingSeat: one(t.bookingSeat),
}));

export const bookingRelations = relations(t.booking, ({ one, many }) => ({
  user: one(t.user, { fields: [t.booking.userId], references: [t.user.id], relationName: "BookingToUser" }),
  references: many(t.bookingReference, { relationName: "BookingToBookingReference" }),
  eventType: one(t.eventType, {
    fields: [t.booking.eventTypeId],
    references: [t.eventType.id],
    relationName: "BookingToEventType",
  }),
  attendees: many(t.attendee, { relationName: "AttendeeToBooking" }),
  payment: many(t.payment, { relationName: "BookingToPayment" }),
  destinationCalendar: one(t.destinationCalendar, {
    fields: [t.booking.destinationCalendarId],
    references: [t.destinationCalendar.id],
    relationName: "BookingToDestinationCalendar",
  }),
  reassignBy: one(t.user, {
    fields: [t.booking.reassignById],
    references: [t.user.id],
    relationName: "reassignByUser",
  }),
  seatsReferences: many(t.bookingSeat, { relationName: "BookingToBookingSeat" }),
  instantMeetingToken: one(t.instantMeetingToken),
  scheduledTriggers: many(t.webhookScheduledTriggers, { relationName: "BookingToWebhookScheduledTriggers" }),
  assignmentReason: many(t.assignmentReason, { relationName: "AssignmentReasonToBooking" }),
  internalNote: many(t.bookingInternalNote, { relationName: "BookingToBookingInternalNote" }),
  tracking: one(t.tracking),
  expenseLogs: many(t.creditExpenseLog, { relationName: "BookingToCreditExpenseLog" }),
  report: one(t.bookingReport),
  wrongAssignmentReports: many(t.wrongAssignmentReport, { relationName: "BookingToWrongAssignmentReport" }),
}));

export const trackingRelations = relations(t.tracking, ({ one }) => ({
  booking: one(t.booking, {
    fields: [t.tracking.bookingId],
    references: [t.booking.id],
    relationName: "BookingToTracking",
  }),
}));

export const scheduleRelations = relations(t.schedule, ({ one, many }) => ({
  user: one(t.user, { fields: [t.schedule.userId], references: [t.user.id], relationName: "ScheduleToUser" }),
  eventType: many(t.eventType, { relationName: "EventTypeToSchedule" }),
  instantMeetingEvents: many(t.eventType, { relationName: "InstantMeetingSchedule" }),
  restrictionSchedule: many(t.eventType, { relationName: "restrictionSchedule" }),
  availability: many(t.availability, { relationName: "AvailabilityToSchedule" }),
  Host: many(t.host, { relationName: "HostToSchedule" }),
}));

export const availabilityRelations = relations(t.availability, ({ one }) => ({
  user: one(t.user, {
    fields: [t.availability.userId],
    references: [t.user.id],
    relationName: "AvailabilityToUser",
  }),
  eventType: one(t.eventType, {
    fields: [t.availability.eventTypeId],
    references: [t.eventType.id],
    relationName: "AvailabilityToEventType",
  }),
  Schedule: one(t.schedule, {
    fields: [t.availability.scheduleId],
    references: [t.schedule.id],
    relationName: "AvailabilityToSchedule",
  }),
}));

export const selectedCalendarRelations = relations(t.selectedCalendar, ({ one, many }) => ({
  user: one(t.user, {
    fields: [t.selectedCalendar.userId],
    references: [t.user.id],
    relationName: "SelectedCalendarToUser",
  }),
  credential: one(t.credential, {
    fields: [t.selectedCalendar.credentialId],
    references: [t.credential.id],
    relationName: "CredentialToSelectedCalendar",
  }),
  delegationCredential: one(t.delegationCredential, {
    fields: [t.selectedCalendar.delegationCredentialId],
    references: [t.delegationCredential.id],
    relationName: "DelegationCredentialToSelectedCalendar",
  }),
  eventType: one(t.eventType, {
    fields: [t.selectedCalendar.eventTypeId],
    references: [t.eventType.id],
    relationName: "EventTypeToSelectedCalendar",
  }),
  calendarCacheEvents: many(t.calendarCacheEvent, { relationName: "CalendarCacheEventToSelectedCalendar" }),
}));

export const eventTypeCustomInputRelations = relations(t.eventTypeCustomInput, ({ one }) => ({
  eventType: one(t.eventType, {
    fields: [t.eventTypeCustomInput.eventTypeId],
    references: [t.eventType.id],
    relationName: "EventTypeToEventTypeCustomInput",
  }),
}));

export const paymentRelations = relations(t.payment, ({ one }) => ({
  app: one(t.app, { fields: [t.payment.appId], references: [t.app.slug], relationName: "AppToPayment" }),
  booking: one(t.booking, {
    fields: [t.payment.bookingId],
    references: [t.booking.id],
    relationName: "BookingToPayment",
  }),
}));

export const webhookRelations = relations(t.webhook, ({ one, many }) => ({
  user: one(t.user, { fields: [t.webhook.userId], references: [t.user.id], relationName: "UserToWebhook" }),
  team: one(t.team, { fields: [t.webhook.teamId], references: [t.team.id], relationName: "TeamToWebhook" }),
  eventType: one(t.eventType, {
    fields: [t.webhook.eventTypeId],
    references: [t.eventType.id],
    relationName: "EventTypeToWebhook",
  }),
  platformOAuthClient: one(t.platformOAuthClient, {
    fields: [t.webhook.platformOAuthClientId],
    references: [t.platformOAuthClient.id],
    relationName: "PlatformOAuthClientToWebhook",
  }),
  app: one(t.app, { fields: [t.webhook.appId], references: [t.app.slug], relationName: "AppToWebhook" }),
  scheduledTriggers: many(t.webhookScheduledTriggers, { relationName: "WebhookToWebhookScheduledTriggers" }),
}));

export const apiKeyRelations = relations(t.apiKey, ({ one, many }) => ({
  user: one(t.user, { fields: [t.apiKey.userId], references: [t.user.id], relationName: "ApiKeyToUser" }),
  team: one(t.team, { fields: [t.apiKey.teamId], references: [t.team.id], relationName: "ApiKeyToTeam" }),
  app: one(t.app, { fields: [t.apiKey.appId], references: [t.app.slug], relationName: "ApiKeyToApp" }),
  rateLimits: many(t.rateLimit, { relationName: "ApiKeyToRateLimit" }),
}));

export const rateLimitRelations = relations(t.rateLimit, ({ one }) => ({
  apiKey: one(t.apiKey, {
    fields: [t.rateLimit.apiKeyId],
    references: [t.apiKey.id],
    relationName: "ApiKeyToRateLimit",
  }),
}));

export const hashedLinkRelations = relations(t.hashedLink, ({ one }) => ({
  eventType: one(t.eventType, {
    fields: [t.hashedLink.eventTypeId],
    references: [t.eventType.id],
    relationName: "EventTypeToHashedLink",
  }),
}));

export const accountRelations = relations(t.account, ({ one }) => ({
  user: one(t.user, { fields: [t.account.userId], references: [t.user.id], relationName: "AccountToUser" }),
}));

export const sessionRelations = relations(t.session, ({ one }) => ({
  user: one(t.user, { fields: [t.session.userId], references: [t.user.id], relationName: "SessionToUser" }),
}));

export const appRelations = relations(t.app, ({ many }) => ({
  credentials: many(t.credential, { relationName: "AppToCredential" }),
  payments: many(t.payment, { relationName: "AppToPayment" }),
  Webhook: many(t.webhook, { relationName: "AppToWebhook" }),
  ApiKey: many(t.apiKey, { relationName: "ApiKeyToApp" }),
}));

export const feedbackRelations = relations(t.feedback, ({ one }) => ({
  user: one(t.user, { fields: [t.feedback.userId], references: [t.user.id], relationName: "FeedbackToUser" }),
}));

export const webhookScheduledTriggersRelations = relations(t.webhookScheduledTriggers, ({ one }) => ({
  webhook: one(t.webhook, {
    fields: [t.webhookScheduledTriggers.webhookId],
    references: [t.webhook.id],
    relationName: "WebhookToWebhookScheduledTriggers",
  }),
  booking: one(t.booking, {
    fields: [t.webhookScheduledTriggers.bookingId],
    references: [t.booking.id],
    relationName: "BookingToWebhookScheduledTriggers",
  }),
}));

export const bookingSeatRelations = relations(t.bookingSeat, ({ one }) => ({
  booking: one(t.booking, {
    fields: [t.bookingSeat.bookingId],
    references: [t.booking.id],
    relationName: "BookingToBookingSeat",
  }),
  attendee: one(t.attendee, {
    fields: [t.bookingSeat.attendeeId],
    references: [t.attendee.id],
    relationName: "AttendeeToBookingSeat",
  }),
}));

export const verifiedNumberRelations = relations(t.verifiedNumber, ({ one }) => ({
  user: one(t.user, {
    fields: [t.verifiedNumber.userId],
    references: [t.user.id],
    relationName: "UserToVerifiedNumber",
  }),
  team: one(t.team, {
    fields: [t.verifiedNumber.teamId],
    references: [t.team.id],
    relationName: "TeamToVerifiedNumber",
  }),
}));

export const verifiedEmailRelations = relations(t.verifiedEmail, ({ one }) => ({
  user: one(t.user, {
    fields: [t.verifiedEmail.userId],
    references: [t.user.id],
    relationName: "UserToVerifiedEmail",
  }),
  team: one(t.team, {
    fields: [t.verifiedEmail.teamId],
    references: [t.team.id],
    relationName: "TeamToVerifiedEmail",
  }),
}));

export const featureRelations = relations(t.feature, ({ many }) => ({
  users: many(t.userFeatures, { relationName: "FeatureToUserFeatures" }),
  teams: many(t.teamFeatures, { relationName: "FeatureToTeamFeatures" }),
}));

export const userFeaturesRelations = relations(t.userFeatures, ({ one }) => ({
  user: one(t.user, {
    fields: [t.userFeatures.userId],
    references: [t.user.id],
    relationName: "UserToUserFeatures",
  }),
  feature: one(t.feature, {
    fields: [t.userFeatures.featureId],
    references: [t.feature.slug],
    relationName: "FeatureToUserFeatures",
  }),
}));

export const teamFeaturesRelations = relations(t.teamFeatures, ({ one }) => ({
  team: one(t.team, {
    fields: [t.teamFeatures.teamId],
    references: [t.team.id],
    relationName: "TeamToTeamFeatures",
  }),
  feature: one(t.feature, {
    fields: [t.teamFeatures.featureId],
    references: [t.feature.slug],
    relationName: "FeatureToTeamFeatures",
  }),
}));

export const oAuthClientRelations = relations(t.oAuthClient, ({ one, many }) => ({
  accessCodes: many(t.accessCode, { relationName: "AccessCodeToOAuthClient" }),
  user: one(t.user, {
    fields: [t.oAuthClient.userId],
    references: [t.user.id],
    relationName: "OAuthClientToUser",
  }),
}));

export const accessCodeRelations = relations(t.accessCode, ({ one }) => ({
  client: one(t.oAuthClient, {
    fields: [t.accessCode.clientId],
    references: [t.oAuthClient.clientId],
    relationName: "AccessCodeToOAuthClient",
  }),
  user: one(t.user, {
    fields: [t.accessCode.userId],
    references: [t.user.id],
    relationName: "AccessCodeToUser",
  }),
  team: one(t.team, {
    fields: [t.accessCode.teamId],
    references: [t.team.id],
    relationName: "AccessCodeToTeam",
  }),
}));

export const calendarCacheRelations = relations(t.calendarCache, ({ one }) => ({
  credential: one(t.credential, {
    fields: [t.calendarCache.credentialId],
    references: [t.credential.id],
    relationName: "CalendarCacheToCredential",
  }),
}));

export const outOfOfficeEntryRelations = relations(t.outOfOfficeEntry, ({ one }) => ({
  user: one(t.user, {
    fields: [t.outOfOfficeEntry.userId],
    references: [t.user.id],
    relationName: "OutOfOfficeEntryToUser",
  }),
  toUser: one(t.user, {
    fields: [t.outOfOfficeEntry.toUserId],
    references: [t.user.id],
    relationName: "toUser",
  }),
  reason: one(t.outOfOfficeReason, {
    fields: [t.outOfOfficeEntry.reasonId],
    references: [t.outOfOfficeReason.id],
    relationName: "OutOfOfficeEntryToOutOfOfficeReason",
  }),
}));

export const outOfOfficeReasonRelations = relations(t.outOfOfficeReason, ({ one, many }) => ({
  user: one(t.user, {
    fields: [t.outOfOfficeReason.userId],
    references: [t.user.id],
    relationName: "OutOfOfficeReasonToUser",
  }),
  entries: many(t.outOfOfficeEntry, { relationName: "OutOfOfficeEntryToOutOfOfficeReason" }),
}));

export const userHolidaySettingsRelations = relations(t.userHolidaySettings, ({ one }) => ({
  user: one(t.user, {
    fields: [t.userHolidaySettings.userId],
    references: [t.user.id],
    relationName: "UserToUserHolidaySettings",
  }),
}));

export const platformOAuthClientRelations = relations(t.platformOAuthClient, ({ one, many }) => ({
  users: many(t.user, { relationName: "PlatformOAuthClientToUser" }),
  organization: one(t.team, {
    fields: [t.platformOAuthClient.organizationId],
    references: [t.team.id],
    relationName: "PlatformOAuthClientToTeam",
  }),
  teams: many(t.team, { relationName: "CreatedByOAuthClient" }),
  accessTokens: many(t.accessToken, { relationName: "AccessTokenToPlatformOAuthClient" }),
  refreshToken: many(t.refreshToken, { relationName: "PlatformOAuthClientToRefreshToken" }),
  authorizationTokens: many(t.platformAuthorizationToken, {
    relationName: "PlatformAuthorizationTokenToPlatformOAuthClient",
  }),
  webhook: many(t.webhook, { relationName: "PlatformOAuthClientToWebhook" }),
}));

export const platformAuthorizationTokenRelations = relations(t.platformAuthorizationToken, ({ one }) => ({
  owner: one(t.user, {
    fields: [t.platformAuthorizationToken.userId],
    references: [t.user.id],
    relationName: "PlatformAuthorizationTokenToUser",
  }),
  client: one(t.platformOAuthClient, {
    fields: [t.platformAuthorizationToken.platformOAuthClientId],
    references: [t.platformOAuthClient.id],
    relationName: "PlatformAuthorizationTokenToPlatformOAuthClient",
  }),
}));

export const accessTokenRelations = relations(t.accessToken, ({ one }) => ({
  owner: one(t.user, {
    fields: [t.accessToken.userId],
    references: [t.user.id],
    relationName: "AccessTokenToUser",
  }),
  client: one(t.platformOAuthClient, {
    fields: [t.accessToken.platformOAuthClientId],
    references: [t.platformOAuthClient.id],
    relationName: "AccessTokenToPlatformOAuthClient",
  }),
}));

export const refreshTokenRelations = relations(t.refreshToken, ({ one }) => ({
  owner: one(t.user, {
    fields: [t.refreshToken.userId],
    references: [t.user.id],
    relationName: "RefreshTokenToUser",
  }),
  client: one(t.platformOAuthClient, {
    fields: [t.refreshToken.platformOAuthClientId],
    references: [t.platformOAuthClient.id],
    relationName: "PlatformOAuthClientToRefreshToken",
  }),
}));

export const dSyncDataRelations = relations(t.dSyncData, ({ one, many }) => ({
  org: one(t.organizationSettings, {
    fields: [t.dSyncData.organizationId],
    references: [t.organizationSettings.organizationId],
    relationName: "DSyncDataToOrganizationSettings",
  }),
  teamGroupMapping: many(t.dSyncTeamGroupMapping, { relationName: "DSyncDataToDSyncTeamGroupMapping" }),
  createdAttributeToUsers: many(t.attributeToUser, { relationName: "createdByDSync" }),
  updatedAttributeToUsers: many(t.attributeToUser, { relationName: "updatedByDSync" }),
}));

export const dSyncTeamGroupMappingRelations = relations(t.dSyncTeamGroupMapping, ({ one }) => ({
  team: one(t.team, {
    fields: [t.dSyncTeamGroupMapping.teamId],
    references: [t.team.id],
    relationName: "DSyncTeamGroupMappingToTeam",
  }),
  directory: one(t.dSyncData, {
    fields: [t.dSyncTeamGroupMapping.directoryId],
    references: [t.dSyncData.directoryId],
    relationName: "DSyncDataToDSyncTeamGroupMapping",
  }),
}));

export const secondaryEmailRelations = relations(t.secondaryEmail, ({ one, many }) => ({
  user: one(t.user, {
    fields: [t.secondaryEmail.userId],
    references: [t.user.id],
    relationName: "SecondaryEmailToUser",
  }),
  verificationTokens: many(t.verificationToken, { relationName: "SecondaryEmailToVerificationToken" }),
  eventTypes: many(t.eventType, { relationName: "EventTypeToSecondaryEmail" }),
}));

export const managedOrganizationRelations = relations(t.managedOrganization, ({ one }) => ({
  managedOrganization: one(t.team, {
    fields: [t.managedOrganization.managedOrganizationId],
    references: [t.team.id],
    relationName: "ManagedOrganization",
  }),
  managerOrganization: one(t.team, {
    fields: [t.managedOrganization.managerOrganizationId],
    references: [t.team.id],
    relationName: "ManagerOrganization",
  }),
}));

export const platformBillingRelations = relations(t.platformBilling, ({ one, many }) => ({
  managerBilling: one(t.platformBilling, {
    fields: [t.platformBilling.managerBillingId],
    references: [t.platformBilling.id],
    relationName: "PlatformManagedBilling",
  }),
  managedBillings: many(t.platformBilling, { relationName: "PlatformManagedBilling" }),
  team: one(t.team, {
    fields: [t.platformBilling.id],
    references: [t.team.id],
    relationName: "PlatformBillingToTeam",
  }),
}));

export const attributeOptionRelations = relations(t.attributeOption, ({ one, many }) => ({
  attribute: one(t.attribute, {
    fields: [t.attributeOption.attributeId],
    references: [t.attribute.id],
    relationName: "AttributeToAttributeOption",
  }),
  assignedUsers: many(t.attributeToUser, { relationName: "AttributeOptionToAttributeToUser" }),
}));

export const attributeRelations = relations(t.attribute, ({ one, many }) => ({
  team: one(t.team, {
    fields: [t.attribute.teamId],
    references: [t.team.id],
    relationName: "AttributeToTeam",
  }),
  options: many(t.attributeOption, { relationName: "AttributeToAttributeOption" }),
  attributeSyncFieldMappings: many(t.attributeSyncFieldMapping, {
    relationName: "AttributeToAttributeSyncFieldMapping",
  }),
}));

export const attributeToUserRelations = relations(t.attributeToUser, ({ one }) => ({
  member: one(t.membership, {
    fields: [t.attributeToUser.memberId],
    references: [t.membership.id],
    relationName: "AttributeToUserToMembership",
  }),
  attributeOption: one(t.attributeOption, {
    fields: [t.attributeToUser.attributeOptionId],
    references: [t.attributeOption.id],
    relationName: "AttributeOptionToAttributeToUser",
  }),
  createdBy: one(t.user, {
    fields: [t.attributeToUser.createdById],
    references: [t.user.id],
    relationName: "createdBy",
  }),
  createdByDSync: one(t.dSyncData, {
    fields: [t.attributeToUser.createdByDSyncId],
    references: [t.dSyncData.directoryId],
    relationName: "createdByDSync",
  }),
  updatedBy: one(t.user, {
    fields: [t.attributeToUser.updatedById],
    references: [t.user.id],
    relationName: "updatedBy",
  }),
  updatedByDSync: one(t.dSyncData, {
    fields: [t.attributeToUser.updatedByDSyncId],
    references: [t.dSyncData.directoryId],
    relationName: "updatedByDSync",
  }),
}));

export const assignmentReasonRelations = relations(t.assignmentReason, ({ one }) => ({
  booking: one(t.booking, {
    fields: [t.assignmentReason.bookingId],
    references: [t.booking.id],
    relationName: "AssignmentReasonToBooking",
  }),
}));

export const delegationCredentialRelations = relations(t.delegationCredential, ({ one, many }) => ({
  workspacePlatform: one(t.workspacePlatform, {
    fields: [t.delegationCredential.workspacePlatformId],
    references: [t.workspacePlatform.id],
    relationName: "DelegationCredentialToWorkspacePlatform",
  }),
  organization: one(t.team, {
    fields: [t.delegationCredential.organizationId],
    references: [t.team.id],
    relationName: "DelegationCredentialToTeam",
  }),
  selectedCalendars: many(t.selectedCalendar, { relationName: "DelegationCredentialToSelectedCalendar" }),
  destinationCalendar: many(t.destinationCalendar, {
    relationName: "DelegationCredentialToDestinationCalendar",
  }),
  bookingReferences: many(t.bookingReference, { relationName: "BookingReferenceToDelegationCredential" }),
  credentials: many(t.credential, { relationName: "CredentialToDelegationCredential" }),
}));

export const workspacePlatformRelations = relations(t.workspacePlatform, ({ many }) => ({
  delegationCredentials: many(t.delegationCredential, {
    relationName: "DelegationCredentialToWorkspacePlatform",
  }),
}));

export const eventTypeTranslationRelations = relations(t.eventTypeTranslation, ({ one }) => ({
  eventType: one(t.eventType, {
    fields: [t.eventTypeTranslation.eventTypeId],
    references: [t.eventType.id],
    relationName: "EventTypeToEventTypeTranslation",
  }),
  creator: one(t.user, {
    fields: [t.eventTypeTranslation.createdBy],
    references: [t.user.id],
    relationName: "CreatedEventTypeTranslations",
  }),
  updater: one(t.user, {
    fields: [t.eventTypeTranslation.updatedBy],
    references: [t.user.id],
    relationName: "UpdatedEventTypeTranslations",
  }),
}));

export const watchlistRelations = relations(t.watchlist, ({ many }) => ({
  bookingReports: many(t.bookingReport, { relationName: "BookingReportToWatchlist" }),
  globalBookingReports: many(t.bookingReport, { relationName: "GlobalBlocklist" }),
  audits: many(t.watchlistAudit, { relationName: "WatchlistToWatchlistAudit" }),
}));

export const watchlistAuditRelations = relations(t.watchlistAudit, ({ one }) => ({
  watchlist: one(t.watchlist, {
    fields: [t.watchlistAudit.watchlistId],
    references: [t.watchlist.id],
    relationName: "WatchlistToWatchlistAudit",
  }),
}));

export const bookingReportRelations = relations(t.bookingReport, ({ one }) => ({
  booking: one(t.booking, {
    fields: [t.bookingReport.bookingUid],
    references: [t.booking.uid],
    relationName: "BookingToBookingReport",
  }),
  reportedBy: one(t.user, {
    fields: [t.bookingReport.reportedById],
    references: [t.user.id],
    relationName: "ReportedBy",
  }),
  organization: one(t.team, {
    fields: [t.bookingReport.organizationId],
    references: [t.team.id],
    relationName: "BookingReportToTeam",
  }),
  watchlist: one(t.watchlist, {
    fields: [t.bookingReport.watchlistId],
    references: [t.watchlist.id],
    relationName: "BookingReportToWatchlist",
  }),
  globalWatchlist: one(t.watchlist, {
    fields: [t.bookingReport.globalWatchlistId],
    references: [t.watchlist.id],
    relationName: "GlobalBlocklist",
  }),
}));

export const wrongAssignmentReportRelations = relations(t.wrongAssignmentReport, ({ one }) => ({
  booking: one(t.booking, {
    fields: [t.wrongAssignmentReport.bookingUid],
    references: [t.booking.uid],
    relationName: "BookingToWrongAssignmentReport",
  }),
  reportedBy: one(t.user, {
    fields: [t.wrongAssignmentReport.reportedById],
    references: [t.user.id],
    relationName: "WrongAssignmentReportedBy",
  }),
  team: one(t.team, {
    fields: [t.wrongAssignmentReport.teamId],
    references: [t.team.id],
    relationName: "TeamToWrongAssignmentReport",
  }),
  reviewedBy: one(t.user, {
    fields: [t.wrongAssignmentReport.reviewedById],
    references: [t.user.id],
    relationName: "WrongAssignmentReviewedBy",
  }),
}));

export const organizationOnboardingRelations = relations(t.organizationOnboarding, ({ one }) => ({
  createdBy: one(t.user, {
    fields: [t.organizationOnboarding.createdById],
    references: [t.user.id],
    relationName: "CreatedOrganizationOnboardings",
  }),
  organization: one(t.team, {
    fields: [t.organizationOnboarding.organizationId],
    references: [t.team.id],
    relationName: "OrganizationOnboardingToTeam",
  }),
}));

export const internalNotePresetRelations = relations(t.internalNotePreset, ({ one, many }) => ({
  team: one(t.team, {
    fields: [t.internalNotePreset.teamId],
    references: [t.team.id],
    relationName: "InternalNotePresetToTeam",
  }),
  BookingInternalNote: many(t.bookingInternalNote, {
    relationName: "BookingInternalNoteToInternalNotePreset",
  }),
}));

export const filterSegmentRelations = relations(t.filterSegment, ({ one, many }) => ({
  user: one(t.user, {
    fields: [t.filterSegment.userId],
    references: [t.user.id],
    relationName: "FilterSegmentToUser",
  }),
  team: one(t.team, {
    fields: [t.filterSegment.teamId],
    references: [t.team.id],
    relationName: "FilterSegmentToTeam",
  }),
  userPreferences: many(t.userFilterSegmentPreference, {
    relationName: "FilterSegmentToUserFilterSegmentPreference",
  }),
}));

export const userFilterSegmentPreferenceRelations = relations(t.userFilterSegmentPreference, ({ one }) => ({
  user: one(t.user, {
    fields: [t.userFilterSegmentPreference.userId],
    references: [t.user.id],
    relationName: "UserToUserFilterSegmentPreference",
  }),
  segment: one(t.filterSegment, {
    fields: [t.userFilterSegmentPreference.segmentId],
    references: [t.filterSegment.id],
    relationName: "FilterSegmentToUserFilterSegmentPreference",
  }),
}));

export const bookingInternalNoteRelations = relations(t.bookingInternalNote, ({ one }) => ({
  notePreset: one(t.internalNotePreset, {
    fields: [t.bookingInternalNote.notePresetId],
    references: [t.internalNotePreset.id],
    relationName: "BookingInternalNoteToInternalNotePreset",
  }),
  booking: one(t.booking, {
    fields: [t.bookingInternalNote.bookingId],
    references: [t.booking.id],
    relationName: "BookingToBookingInternalNote",
  }),
  createdBy: one(t.user, {
    fields: [t.bookingInternalNote.createdById],
    references: [t.user.id],
    relationName: "BookingInternalNoteToUser",
  }),
}));

export const roleRelations = relations(t.role, ({ one, many }) => ({
  team: one(t.team, { fields: [t.role.teamId], references: [t.team.id], relationName: "RoleToTeam" }),
  permissions: many(t.rolePermission, { relationName: "RoleToRolePermission" }),
  memberships: many(t.membership, { relationName: "MembershipToRole" }),
}));

export const rolePermissionRelations = relations(t.rolePermission, ({ one }) => ({
  role: one(t.role, {
    fields: [t.rolePermission.roleId],
    references: [t.role.id],
    relationName: "RoleToRolePermission",
  }),
}));

export const auditActorRelations = relations(t.auditActor, ({ many }) => ({
  bookingAudits: many(t.bookingAudit, { relationName: "AuditActorToBookingAudit" }),
}));

export const bookingAuditRelations = relations(t.bookingAudit, ({ one }) => ({
  actor: one(t.auditActor, {
    fields: [t.bookingAudit.actorId],
    references: [t.auditActor.id],
    relationName: "AuditActorToBookingAudit",
  }),
}));

export const agentRelations = relations(t.agent, ({ one, many }) => ({
  user: one(t.user, { fields: [t.agent.userId], references: [t.user.id], relationName: "AgentToUser" }),
  team: one(t.team, { fields: [t.agent.teamId], references: [t.team.id], relationName: "AgentToTeam" }),
  inboundPhoneNumbers: many(t.calAiPhoneNumber, { relationName: "InboundAgent" }),
  outboundPhoneNumbers: many(t.calAiPhoneNumber, { relationName: "OutboundAgent" }),
}));

export const calAiPhoneNumberRelations = relations(t.calAiPhoneNumber, ({ one }) => ({
  user: one(t.user, {
    fields: [t.calAiPhoneNumber.userId],
    references: [t.user.id],
    relationName: "CalAiPhoneNumberToUser",
  }),
  team: one(t.team, {
    fields: [t.calAiPhoneNumber.teamId],
    references: [t.team.id],
    relationName: "CalAiPhoneNumberToTeam",
  }),
  inboundAgent: one(t.agent, {
    fields: [t.calAiPhoneNumber.inboundAgentId],
    references: [t.agent.id],
    relationName: "InboundAgent",
  }),
  outboundAgent: one(t.agent, {
    fields: [t.calAiPhoneNumber.outboundAgentId],
    references: [t.agent.id],
    relationName: "OutboundAgent",
  }),
}));

export const teamBillingRelations = relations(t.teamBilling, ({ one, many }) => ({
  team: one(t.team, { fields: [t.teamBilling.teamId], references: [t.team.id], relationName: "TeamBilling" }),
  monthlyProrations: many(t.monthlyProration, { relationName: "MonthlyProrationToTeamBilling" }),
  seatChangeLogs: many(t.seatChangeLog, { relationName: "SeatChangeLogToTeamBilling" }),
}));

export const organizationBillingRelations = relations(t.organizationBilling, ({ one, many }) => ({
  team: one(t.team, {
    fields: [t.organizationBilling.teamId],
    references: [t.team.id],
    relationName: "OrganizationBilling",
  }),
  monthlyProrations: many(t.monthlyProration, { relationName: "MonthlyProrationToOrganizationBilling" }),
  seatChangeLogs: many(t.seatChangeLog, { relationName: "OrganizationBillingToSeatChangeLog" }),
}));

export const seatChangeLogRelations = relations(t.seatChangeLog, ({ one }) => ({
  team: one(t.team, {
    fields: [t.seatChangeLog.teamId],
    references: [t.team.id],
    relationName: "SeatChangeLogToTeam",
  }),
  proration: one(t.monthlyProration, {
    fields: [t.seatChangeLog.processedInProrationId],
    references: [t.monthlyProration.id],
    relationName: "MonthlyProrationToSeatChangeLog",
  }),
  teamBilling: one(t.teamBilling, {
    fields: [t.seatChangeLog.teamBillingId],
    references: [t.teamBilling.id],
    relationName: "SeatChangeLogToTeamBilling",
  }),
  organizationBilling: one(t.organizationBilling, {
    fields: [t.seatChangeLog.organizationBillingId],
    references: [t.organizationBilling.id],
    relationName: "OrganizationBillingToSeatChangeLog",
  }),
}));

export const monthlyProrationRelations = relations(t.monthlyProration, ({ one, many }) => ({
  team: one(t.team, {
    fields: [t.monthlyProration.teamId],
    references: [t.team.id],
    relationName: "MonthlyProrationToTeam",
  }),
  seatChanges: many(t.seatChangeLog, { relationName: "MonthlyProrationToSeatChangeLog" }),
  teamBilling: one(t.teamBilling, {
    fields: [t.monthlyProration.teamBillingId],
    references: [t.teamBilling.id],
    relationName: "MonthlyProrationToTeamBilling",
  }),
  organizationBilling: one(t.organizationBilling, {
    fields: [t.monthlyProration.organizationBillingId],
    references: [t.organizationBilling.id],
    relationName: "MonthlyProrationToOrganizationBilling",
  }),
}));

export const calendarCacheEventRelations = relations(t.calendarCacheEvent, ({ one }) => ({
  selectedCalendar: one(t.selectedCalendar, {
    fields: [t.calendarCacheEvent.selectedCalendarId],
    references: [t.selectedCalendar.id],
    relationName: "CalendarCacheEventToSelectedCalendar",
  }),
}));

export const integrationAttributeSyncRelations = relations(t.integrationAttributeSync, ({ one, many }) => ({
  organization: one(t.team, {
    fields: [t.integrationAttributeSync.organizationId],
    references: [t.team.id],
    relationName: "IntegrationAttributeSyncToTeam",
  }),
  credential: one(t.credential, {
    fields: [t.integrationAttributeSync.credentialId],
    references: [t.credential.id],
    relationName: "CredentialToIntegrationAttributeSync",
  }),
  attributeSyncRule: one(t.attributeSyncRule),
  syncFieldMappings: many(t.attributeSyncFieldMapping, {
    relationName: "AttributeSyncFieldMappingToIntegrationAttributeSync",
  }),
}));

export const attributeSyncRuleRelations = relations(t.attributeSyncRule, ({ one }) => ({
  integrationAttributeSync: one(t.integrationAttributeSync, {
    fields: [t.attributeSyncRule.integrationAttributeSyncId],
    references: [t.integrationAttributeSync.id],
    relationName: "AttributeSyncRuleToIntegrationAttributeSync",
  }),
}));

export const attributeSyncFieldMappingRelations = relations(t.attributeSyncFieldMapping, ({ one }) => ({
  attribute: one(t.attribute, {
    fields: [t.attributeSyncFieldMapping.attributeId],
    references: [t.attribute.id],
    relationName: "AttributeToAttributeSyncFieldMapping",
  }),
  integrationAttributeSync: one(t.integrationAttributeSync, {
    fields: [t.attributeSyncFieldMapping.integrationAttributeSyncId],
    references: [t.integrationAttributeSync.id],
    relationName: "AttributeSyncFieldMappingToIntegrationAttributeSync",
  }),
}));
