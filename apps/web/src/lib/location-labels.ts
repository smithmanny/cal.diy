import { APPS } from "./apps";

/**
 * Translation keys for location types. App names are proper nouns that aren't translated, so
 * they stand in for their own key (t() returns a key it doesn't know unchanged).
 */
export const LOCATION_LABEL_KEYS: Record<string, string> = {
  inPerson: "in_person_meeting",
  link: "link_meeting",
  phone: "attendee_phone_number",
  userPhone: "organizer_phone_number",
  "integrations:google:meet": "google_meet",
  ...Object.fromEntries(APPS.flatMap((app) => (app.locationType ? [[app.locationType, app.name]] : []))),
};
