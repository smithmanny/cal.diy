import { describe, expect, it } from "vitest";
import {
  applyBookingFieldInputs,
  type BookingField,
  BookingFieldsError,
  doesEmailMatchEntry,
  parseBookingFields,
  prefillFromSearch,
  toBookingFieldInput,
  validateBookingResponses,
  withSystemFields,
} from "./booking-fields";

const names = (fields: BookingField[]) => fields.map((field) => field.name);

const SYSTEM_ORDER = [
  "name",
  "email",
  "attendeePhoneNumber",
  "location",
  "title",
  "notes",
  "guests",
  "rescheduleReason",
];

describe("withSystemFields", () => {
  it("gives an event without questions Cal's defaults", () => {
    const fields = withSystemFields([]);
    expect(names(fields)).toEqual(SYSTEM_ORDER);
    expect(fields.find((field) => field.name === "guests")?.hidden).toBe(false);
    expect(
      withSystemFields([], { disableGuests: true }).find((field) => field.name === "guests")?.hidden
    ).toBe(true);
  });

  it("puts host questions between the booker's details and the notes", () => {
    const fields = withSystemFields([{ name: "company", type: "text", editable: "user" }]);
    expect(names(fields)).toEqual([...SYSTEM_ORDER.slice(0, 4), "company", ...SYSTEM_ORDER.slice(4)]);
  });

  it("keeps the stored order and wording, but never a system field's type or role", () => {
    const fields = withSystemFields([
      { name: "notes", type: "text", label: "Anything else?", required: true, editable: "user" },
      { name: "company", type: "text", editable: "user" },
      { name: "name", type: "text", required: false, hidden: true },
    ]);
    expect(names(fields).slice(0, 6)).toEqual([
      "email",
      "attendeePhoneNumber",
      "location",
      "notes",
      "company",
      "name",
    ]);
    const notes = fields.find((field) => field.name === "notes");
    expect(notes).toMatchObject({
      type: "textarea",
      label: "Anything else?",
      required: true,
      editable: "system-but-optional",
    });
    expect(fields.find((field) => field.name === "name")).toMatchObject({
      type: "name",
      required: true,
      hidden: undefined,
    });
  });
});

describe("parseBookingFields", () => {
  it("skips malformed entries and keeps unknown Cal properties", () => {
    const parsed = parseBookingFields([
      { name: "ok", type: "text", variant: "x" },
      { name: "bad name!", type: "text" },
      { name: "x", type: "unknown" },
      "nope",
    ]);
    expect(parsed).toEqual([{ name: "ok", type: "text", variant: "x" }]);
    expect(parseBookingFields(null)).toEqual([]);
  });
});

describe("applyBookingFieldInputs", () => {
  const editorFields = () => withSystemFields([]).map(toBookingFieldInput);

  it("adds host questions and lets hosts hide or require optional system fields", () => {
    const inputs = editorFields().map((field) =>
      field.name === "notes" ? { ...field, required: true, label: "Agenda" } : field
    );
    inputs.splice(4, 0, {
      name: "size",
      type: "select",
      label: "Team size",
      required: true,
      hidden: false,
      options: [{ label: "Small", value: "small" }],
    });
    const result = applyBookingFieldInputs([], inputs);
    expect(result.find((field) => field.name === "size")).toMatchObject({
      editable: "user",
      options: [{ label: "Small", value: "small" }],
      sources: [{ id: "user" }],
    });
    expect(result.find((field) => field.name === "notes")).toMatchObject({ required: true, label: "Agenda" });
  });

  it("refuses changes to locked system fields, removed system fields and duplicates", () => {
    const locked = editorFields().map((field) =>
      field.name === "name" ? { ...field, required: false, hidden: true, type: "text" as const } : field
    );
    expect(applyBookingFieldInputs([], locked).find((field) => field.name === "name")).toMatchObject({
      type: "name",
      required: true,
    });
    expect(() => applyBookingFieldInputs([], editorFields().slice(1))).toThrow(BookingFieldsError);
    const fields = editorFields();
    expect(() => applyBookingFieldInputs([], [...fields, fields[5]])).toThrow(
      "form_builder_field_already_exists"
    );
    expect(() =>
      applyBookingFieldInputs(
        [],
        [...fields, { name: "loc2", type: "radioInput", required: false, hidden: false }]
      )
    ).toThrow("booking_question_type_not_allowed");
  });
});

describe("validateBookingResponses", () => {
  const fields = withSystemFields([
    { name: "company", type: "text", required: true, editable: "user", maxLength: 5 },
    { name: "agree", type: "boolean", required: true, editable: "user" },
    { name: "site", type: "url", editable: "user" },
    { name: "topics", type: "checkbox", editable: "user", options: [{ label: "A", value: "a" }] },
    { name: "email", type: "email", requireEmails: "@acme.com, partner.org" },
  ]);
  const base = { name: "Ann", email: "ann@acme.com", company: "Acme", agree: "true" };
  const options = { view: "booking" as const, locationTypes: ["link"] };
  const errorsFor = (responses: Record<string, unknown>) =>
    validateBookingResponses(fields, { ...base, ...responses }, options).errors;

  it("normalizes answers and fills in the only location", () => {
    const { responses, errors } = validateBookingResponses(
      fields,
      { ...base, topics: "a", site: "acme.com" },
      options
    );
    expect(errors).toEqual([]);
    expect(responses).toEqual({
      name: "Ann",
      email: "ann@acme.com",
      location: { value: "link", optionValue: "" },
      company: "Acme",
      agree: true,
      site: "acme.com",
      topics: ["a"],
    });
  });

  it("reports each failed check against its field", () => {
    expect(errorsFor({ company: "" })).toEqual([{ field: "company", key: "error_required_field" }]);
    expect(errorsFor({ company: "Acme Inc" })).toEqual([
      { field: "company", key: "max_characters_allowed", values: { count: 5 } },
    ]);
    expect(errorsFor({ agree: false })).toEqual([{ field: "agree", key: "error_required_field" }]);
    expect(errorsFor({ site: "https:/acme.com" })).toEqual([{ field: "site", key: "url_validation_error" }]);
    expect(errorsFor({ topics: ["b"] })).toEqual([{ field: "topics", key: "error_required_field" }]);
    expect(errorsFor({ email: "ann@other.com" })).toEqual([
      { field: "email", key: "require_emails_no_match_found_error_message" },
    ]);
    expect(errorsFor({ email: "x@partner.org" })).toEqual([]);
    expect(errorsFor({ guests: ["nope"] })).toEqual([{ field: "guests", key: "email_validation_error" }]);
  });

  it("checks the chosen location and its required input", () => {
    const twoLocations = { view: "booking" as const, locationTypes: ["link", "phone"] };
    const check = (location: unknown) =>
      validateBookingResponses(fields, { ...base, location }, twoLocations).errors;
    expect(check({ value: "phone", optionValue: "" })).toEqual([
      { field: "location", key: "error_required_field" },
    ]);
    expect(check({ value: "phone", optionValue: "abc" })).toEqual([
      { field: "location", key: "invalid_number" },
    ]);
    expect(check({ value: "inPerson" })).toEqual([{ field: "location", key: "error_required_field" }]);
    expect(check({ value: "phone", optionValue: "+1 555 0100" })).toEqual([]);
  });

  it("ignores hidden questions and those for another view", () => {
    const { responses } = validateBookingResponses(
      fields,
      { ...base, title: "x", attendeePhoneNumber: "+1 555 0100", rescheduleReason: "y" },
      options
    );
    expect(responses).not.toHaveProperty("title");
    expect(responses).not.toHaveProperty("attendeePhoneNumber");
    expect(responses).not.toHaveProperty("rescheduleReason");
    const rescheduled = validateBookingResponses(
      fields,
      { ...base, rescheduleReason: "y" },
      { ...options, view: "reschedule" }
    );
    expect(rescheduled.responses.rescheduleReason).toBe("y");
  });
});

describe("doesEmailMatchEntry", () => {
  it("matches addresses exactly and domains with or without @", () => {
    expect(doesEmailMatchEntry("Ann@Acme.com", "ann@acme.com")).toBe(true);
    expect(doesEmailMatchEntry("ann@acme.com", "@acme.com")).toBe(true);
    expect(doesEmailMatchEntry("ann@acme.com", "acme.com")).toBe(true);
    expect(doesEmailMatchEntry("ann@notacme.com", "acme.com")).toBe(false);
  });
});

describe("prefillFromSearch", () => {
  const fields = withSystemFields([
    { name: "agree", type: "boolean", editable: "user" },
    { name: "topics", type: "multiselect", editable: "user", options: [{ label: "A", value: "a" }] },
  ]);

  it("fills answers by question name, repeating parameters for lists", () => {
    const search = new URLSearchParams(
      "name=Ada&email=ada@example.com&guests=a@x.com&guests=b@x.com&agree=true&topics=a&unknown=1"
    );
    expect(prefillFromSearch(fields, search)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      guests: ["a@x.com", "b@x.com"],
      agree: true,
      topics: ["a"],
    });
  });

  it("leaves the location and empty parameters alone", () => {
    expect(prefillFromSearch(fields, new URLSearchParams("location=x&name="))).toEqual({});
  });
});
