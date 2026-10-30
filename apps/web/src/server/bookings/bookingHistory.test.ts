import { describe, expect, it } from "vitest";
import { historyDetails, historyTitle } from "./bookingHistory";

const formatDate = (epochMs: number) => new Date(epochMs).toISOString().slice(0, 10);
const hostName = (uuid: string | null) => (uuid === "u-1" ? "Hana Host" : "Unknown");
const stored = (fields: Record<string, unknown>) => ({ version: 1, fields });

describe("historyTitle", () => {
  it("names the host a booking was made with, and seats", () => {
    expect(
      historyTitle("CREATED", stored({ hostUserUuid: "u-1", status: "ACCEPTED" }), formatDate, hostName)
    ).toEqual({ key: "booking_audit_action.created", values: { host: "Hana Host" } });
    expect(
      historyTitle("CREATED", stored({ hostUserUuid: null, seatReferenceUid: "s" }), formatDate, hostName).key
    ).toBe("booking_audit_action.created_with_seat");
  });

  it("shows both dates of a reschedule", () => {
    const fields = stored({
      startTime: { old: Date.UTC(2030, 0, 1), new: Date.UTC(2030, 0, 2) },
      endTime: { old: 0, new: 0 },
      rescheduledToUid: { old: null, new: "b2" },
    });
    expect(historyTitle("RESCHEDULED", fields, formatDate, hostName)).toEqual({
      key: "booking_audit_action.rescheduled",
      values: { oldDate: "2030-01-01", newDate: "2030-01-02" },
    });
  });

  it("describes location changes and no-show updates", () => {
    expect(
      historyTitle(
        "LOCATION_CHANGED",
        stored({ location: { old: null, new: "Office" } }),
        formatDate,
        hostName
      )
    ).toEqual({
      key: "booking_audit_action.location_changed_from_to",
      values: { fromLocation: "-", toLocation: "Office" },
    });
    expect(historyTitle("NO_SHOW_UPDATED", stored({ attendeesNoShow: [] }), formatDate, hostName).key).toBe(
      "booking_audit_action.attendee_no_show_updated"
    );
  });

  it("falls back for unreadable records", () => {
    expect(historyTitle("CANCELLED", null, formatDate, hostName).key).toBe("booking_audit_action.cancelled");
    expect(historyTitle("CREATED", "garbage", formatDate, hostName).values.host).toBe("Unknown");
  });
});

describe("historyDetails", () => {
  it("lists reasons, added guests and no-show changes", () => {
    expect(historyDetails("CANCELLED", stored({ cancellationReason: "Sick" }))).toEqual([
      { label: "cancellation_reason", value: "Sick" },
    ]);
    expect(historyDetails("ATTENDEE_ADDED", stored({ added: ["a@x.com", "b@x.com"] }))).toEqual([
      { label: "booking_audit_action.attendees", value: "a@x.com, b@x.com" },
    ]);
    expect(
      historyDetails(
        "NO_SHOW_UPDATED",
        stored({ attendeesNoShow: [{ attendeeEmail: "a@x.com", noShow: { old: false, new: true } }] })
      )
    ).toEqual([{ label: "a@x.com", value: "yes" }]);
    expect(historyDetails("ACCEPTED", stored({}))).toEqual([]);
  });
});
