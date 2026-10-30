import {
  account,
  apiKey,
  app,
  attendee,
  availability,
  booking,
  bookingReference,
  bookingSeat,
  credential,
  destinationCalendar,
  eventType,
  hashedLink,
  host,
  membership,
  outOfOfficeEntry,
  outOfOfficeReason,
  schedule,
  secondaryEmail,
  selectedCalendar,
  team,
  travelSchedule,
  twoFactor,
  user,
  userHolidaySettings,
  verifiedEmail,
  webhook,
} from "@calcom/db/schema";
import type { ImportStep } from "./importer";
import {
  mapApiKey,
  mapEventType,
  mapNextAuthAccount,
  mapUser,
  mapUserPassword,
  type TwoFactorCrypto,
  twoFactorFromUser,
} from "./mappers";

// Teams, their members and event types come over; what a team owns that the new app has no team
// feature for (installed apps, webhooks, verified emails) is left out.
const TEAM_OWNED = ["teamId"];

/** What gets imported, in an order where every row's references are already in place. */
export function importPlan(crypto: TwoFactorCrypto): ImportStep[] {
  return [
    // App rows hold the app keys an admin configured (e.g. Google's client id) and are what
    // Credential.appId points at.
    { source: "App", target: app },
    { source: "Team", target: team },
    { source: "users", target: user, map: mapUser },
    { source: "Membership", target: membership },
    { source: "Account", target: account, map: mapNextAuthAccount },
    { source: "UserPassword", target: account, map: mapUserPassword },
    {
      source: "users",
      target: twoFactor,
      map: (row, context) => twoFactorFromUser(row, crypto, context.warn),
    },
    { source: "Schedule", target: schedule },
    { source: "Credential", target: credential, skipWhenSet: TEAM_OWNED },
    { source: "EventType", target: eventType, map: mapEventType },
    { source: "DestinationCalendar", target: destinationCalendar },
    { source: "SelectedCalendar", target: selectedCalendar },
    { source: "Availability", target: availability },
    { source: "Host", target: host },
    { source: "HashedLink", target: hashedLink },
    { source: "Booking", target: booking },
    { source: "Attendee", target: attendee },
    { source: "BookingSeat", target: bookingSeat },
    { source: "BookingReference", target: bookingReference },
    { source: "Webhook", target: webhook, skipWhenSet: [...TEAM_OWNED, "platformOAuthClientId"] },
    { source: "ApiKey", target: apiKey, map: mapApiKey },
    { source: "TravelSchedule", target: travelSchedule },
    { source: "OutOfOfficeReason", target: outOfOfficeReason, keepExisting: true },
    { source: "OutOfOfficeEntry", target: outOfOfficeEntry },
    { source: "UserHolidaySettings", target: userHolidaySettings },
    { source: "SecondaryEmail", target: secondaryEmail },
    { source: "VerifiedEmail", target: verifiedEmail, skipWhenSet: TEAM_OWNED },
  ];
}
