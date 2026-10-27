import "@tanstack/react-start/server-only";

import type { JsonValue } from "@calcom/db/ids";
import slugify from "@calcom/lib/slugify";
import {
  applyBookingFieldInputs,
  BookingFieldsError,
  parseBookingFields,
  toBookingFieldInput,
  withSystemFields,
} from "~/lib/booking-fields";
import { AppError } from "../errors";
import type { ScheduleRepository } from "../schedules/ScheduleRepository";
import type { EventTypeRepository, EventTypeRow } from "./EventTypeRepository";
import {
  mergeMetadata,
  parseConfirmationThreshold,
  parseDisabledConfirmationEmails,
  parseEventTypeColor,
  parseIntervalLimit,
  parseMetadata,
  parseMultipleDuration,
  toPeriodType,
} from "./fields";
import {
  type EventLocation,
  type EventTypeDto,
  type EventTypeInput,
  type EventTypeSummaryDto,
  eventLocationSchema,
  type NewEventTypeInput,
} from "./types";

type Deps = {
  eventTypeRepo: EventTypeRepository;
  scheduleRepo: Pick<ScheduleRepository, "existsForUser">;
};

function parseLocations(value: unknown): EventLocation[] {
  if (!Array.isArray(value)) return [];
  // Rows written by older code may hold location types this app doesn't support yet; skip them.
  return value.flatMap((item) => {
    const parsed = eventLocationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const dayKeyUtc = (date: Date) => date.toISOString().slice(0, 10);

function toDto(row: EventTypeRow): EventTypeDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    length: row.length,
    multipleDuration: parseMultipleDuration(row.metadata),
    hidden: row.hidden,
    scheduleId: row.scheduleId,
    locations: parseLocations(row.locations),
    minimumBookingNotice: row.minimumBookingNotice,
    beforeEventBuffer: row.beforeEventBuffer,
    afterEventBuffer: row.afterEventBuffer,
    slotInterval: row.slotInterval,
    periodType: toPeriodType(row.periodType),
    periodDays: row.periodDays,
    periodCountCalendarDays: row.periodCountCalendarDays ?? true,
    periodStartDate: row.periodStartDate ? dayKeyUtc(row.periodStartDate) : null,
    periodEndDate: row.periodEndDate ? dayKeyUtc(row.periodEndDate) : null,
    offsetStart: row.offsetStart,
    onlyShowFirstAvailableSlot: row.onlyShowFirstAvailableSlot ?? false,
    bookingLimits: parseIntervalLimit(row.bookingLimits),
    durationLimits: parseIntervalLimit(row.durationLimits),
    maxActiveBookingsPerBooker: row.maxActiveBookingsPerBooker,
    maxActiveBookingPerBookerOfferReschedule: row.maxActiveBookingPerBookerOfferReschedule ?? false,
    requiresConfirmation: row.requiresConfirmation,
    requiresConfirmationThreshold: parseConfirmationThreshold(row.metadata),
    requiresConfirmationWillBlockSlot: row.requiresConfirmationWillBlockSlot,
    disableCancelling: row.disableCancelling ?? false,
    disableRescheduling: row.disableRescheduling ?? false,
    minimumRescheduleNotice: row.minimumRescheduleNotice,
    successRedirectUrl: row.successRedirectUrl,
    forwardParamsSuccessRedirect: row.forwardParamsSuccessRedirect ?? true,
    eventName: row.eventName,
    hideCalendarNotes: row.hideCalendarNotes,
    hideCalendarEventDetails: row.hideCalendarEventDetails,
    hideOrganizerEmail: row.hideOrganizerEmail,
    requiresBookerEmailVerification: row.requiresBookerEmailVerification,
    lockTimeZoneToggleOnBookingPage: row.lockTimeZoneToggleOnBookingPage,
    lockedTimeZone: row.lockedTimeZone,
    eventTypeColor: parseEventTypeColor(row.eventTypeColor),
    interfaceLanguage: row.interfaceLanguage || null,
    disableConfirmationEmails: parseDisabledConfirmationEmails(row.metadata),
    bookingFields: withSystemFields(parseBookingFields(row.bookingFields), {
      disableGuests: row.disableGuests,
    }).map(toBookingFieldInput),
  };
}

/** Updates disableStandardEmails.confirmation, keeping Cal's other switches (e.g. `all`). */
function disableStandardEmails(metadata: unknown, confirmation: EventTypeInput["disableConfirmationEmails"]) {
  const current = parseMetadata(metadata).disableStandardEmails;
  const rest = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
  delete rest.confirmation;
  const next = confirmation.host || confirmation.attendee ? { ...rest, confirmation } : rest;
  return Object.keys(next).length ? next : null;
}

function applyBookingFields(row: EventTypeRow, input: EventTypeInput): JsonValue {
  try {
    const fields = applyBookingFieldInputs(parseBookingFields(row.bookingFields), input.bookingFields, {
      disableGuests: row.disableGuests,
    });
    // Fields are plain JSON parsed from the column or the request; the round trip drops undefined.
    return JSON.parse(JSON.stringify(fields)) as JsonValue;
  } catch (error) {
    if (error instanceof BookingFieldsError) throw new AppError(error.message);
    throw error;
  }
}

export class EventTypeService {
  constructor(private readonly deps: Deps) {}

  async list(userId: number): Promise<EventTypeSummaryDto[]> {
    const rows = await this.deps.eventTypeRepo.findManyByUserId(userId);
    return rows.map((row) => ({ ...row, eventTypeColor: parseEventTypeColor(row.eventTypeColor) }));
  }

  async get(userId: number, id: number): Promise<EventTypeDto> {
    return toDto(await this.findOwned(userId, id));
  }

  async create(userId: number, input: NewEventTypeInput): Promise<{ id: number }> {
    const slug = await this.assertSlugAvailable(userId, input.slug || input.title);
    const position = (await this.deps.eventTypeRepo.findMaxPositionForUser(userId)) + 1;
    return this.deps.eventTypeRepo.create(userId, {
      title: input.title,
      slug,
      description: input.description,
      length: input.length,
      position,
    });
  }

  /** Cal's onboarding gives every new user these two, so their booking page isn't empty. */
  async createDefaults(userId: number, titles: { fifteen: string; thirty: string }): Promise<void> {
    await this.deps.eventTypeRepo.createMany(userId, [
      { title: titles.thirty, slug: "30min", length: 30, position: 2 },
      { title: titles.fifteen, slug: "15min", length: 15, position: 1 },
    ]);
  }

  async update(userId: number, id: number, input: EventTypeInput): Promise<void> {
    const row = await this.findOwned(userId, id);
    const slug = await this.assertSlugAvailable(userId, input.slug, id);
    if (
      input.scheduleId !== null &&
      !(await this.deps.scheduleRepo.existsForUser(input.scheduleId, userId))
    ) {
      throw new AppError("not_found", 404);
    }
    await this.deps.eventTypeRepo.update(id, {
      title: input.title,
      slug,
      description: input.description,
      length: input.length,
      hidden: input.hidden,
      scheduleId: input.scheduleId,
      locations: input.locations,
      minimumBookingNotice: input.minimumBookingNotice,
      beforeEventBuffer: input.beforeEventBuffer,
      afterEventBuffer: input.afterEventBuffer,
      slotInterval: input.slotInterval,
      periodType: input.periodType,
      periodDays:
        input.periodType === "ROLLING" || input.periodType === "ROLLING_WINDOW" ? input.periodDays : null,
      periodCountCalendarDays: input.periodCountCalendarDays,
      // Calendar dates at UTC midnight, as Cal stores them.
      periodStartDate:
        input.periodType === "RANGE" && input.periodStartDate
          ? new Date(`${input.periodStartDate}T00:00:00Z`)
          : null,
      periodEndDate:
        input.periodType === "RANGE" && input.periodEndDate
          ? new Date(`${input.periodEndDate}T00:00:00Z`)
          : null,
      offsetStart: input.offsetStart,
      onlyShowFirstAvailableSlot: input.onlyShowFirstAvailableSlot,
      bookingLimits: input.bookingLimits,
      durationLimits: input.durationLimits,
      maxActiveBookingsPerBooker: input.maxActiveBookingsPerBooker,
      maxActiveBookingPerBookerOfferReschedule: input.maxActiveBookingPerBookerOfferReschedule,
      requiresConfirmation: input.requiresConfirmation,
      requiresConfirmationWillBlockSlot:
        input.requiresConfirmation && input.requiresConfirmationWillBlockSlot,
      metadata: mergeMetadata(row.metadata, {
        requiresConfirmationThreshold: input.requiresConfirmation
          ? input.requiresConfirmationThreshold
          : null,
        disableStandardEmails: disableStandardEmails(row.metadata, input.disableConfirmationEmails),
        multipleDuration:
          input.multipleDuration && input.multipleDuration.length > 1
            ? [...new Set(input.multipleDuration)].sort((a, b) => a - b)
            : null,
      }),
      hideCalendarNotes: input.hideCalendarNotes,
      hideCalendarEventDetails: input.hideCalendarEventDetails,
      hideOrganizerEmail: input.hideOrganizerEmail,
      requiresBookerEmailVerification: input.requiresBookerEmailVerification,
      lockTimeZoneToggleOnBookingPage: input.lockTimeZoneToggleOnBookingPage,
      lockedTimeZone: input.lockTimeZoneToggleOnBookingPage ? input.lockedTimeZone : null,
      eventTypeColor: input.eventTypeColor,
      interfaceLanguage: input.interfaceLanguage,
      disableCancelling: input.disableCancelling,
      disableRescheduling: input.disableRescheduling,
      minimumRescheduleNotice: input.minimumRescheduleNotice,
      successRedirectUrl: input.successRedirectUrl || null,
      forwardParamsSuccessRedirect: input.forwardParamsSuccessRedirect,
      eventName: input.eventName || null,
      bookingFields: applyBookingFields(row, input),
    });
  }

  async setHidden(userId: number, id: number, hidden: boolean): Promise<void> {
    await this.findOwned(userId, id);
    await this.deps.eventTypeRepo.update(id, { hidden });
  }

  async delete(userId: number, id: number): Promise<void> {
    await this.findOwned(userId, id);
    await this.deps.eventTypeRepo.deleteById(id);
  }

  private async findOwned(userId: number, id: number): Promise<EventTypeRow> {
    const found = await this.deps.eventTypeRepo.findById(id);
    if (!found || found.userId !== userId) throw new AppError("not_found", 404);
    return found;
  }

  private async assertSlugAvailable(userId: number, raw: string, excludeId?: number): Promise<string> {
    const slug = slugify(raw);
    if (!slug) throw new AppError("url_taken");
    if (await this.deps.eventTypeRepo.slugExistsForUser(userId, slug, excludeId))
      throw new AppError("url_taken", 409);
    return slug;
  }
}
