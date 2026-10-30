import dayjs from "@calcom/dayjs";

/**
 * A trip covers whole days where the host will be: from midnight on the first day to the end of the
 * last day, both in the travel time zone. No end date means "until further notice".
 */
export function travelPeriod(input: { timeZone: string; startDate: string; endDate: string | null }) {
  return {
    start: dayjs.tz(input.startDate, input.timeZone).startOf("day").toDate(),
    end: input.endDate ? dayjs.tz(input.endDate, input.timeZone).endOf("day").toDate() : null,
  };
}
