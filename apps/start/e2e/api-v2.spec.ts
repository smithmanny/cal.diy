import type { APIRequestContext, Page } from "@playwright/test";
import { signUp, uniqueName } from "./support/helpers";
import { expect, test } from "./support/test";

async function createApiKey(page: Page): Promise<string> {
  await page.goto("/settings/developer/api-keys");
  await page.getByRole("button", { name: "Create an API key" }).click();
  await page.getByLabel("Name this key").fill("API v2 e2e");
  await page.getByLabel("Expiration date").selectOption({ label: "Never expires" });
  await page.getByRole("button", { name: "Create", exact: true }).click();
  return (await page.getByTestId("new-api-key").textContent()) ?? "";
}

/** Calls Cal's API v2 as an integration would, with the key and version header it needs. */
function client(request: APIRequestContext, key: string | null) {
  const headers = (version?: string) => ({
    ...(key ? { authorization: `Bearer ${key}` } : {}),
    ...(version ? { "cal-api-version": version } : {}),
  });
  return {
    get: (path: string, version?: string) => request.get(`/api/v2${path}`, { headers: headers(version) }),
    post: (path: string, data: unknown, version?: string) =>
      request.post(`/api/v2${path}`, { headers: headers(version), data }),
    patch: (path: string, data: unknown, version?: string) =>
      request.patch(`/api/v2${path}`, { headers: headers(version), data }),
    delete: (path: string, version?: string) =>
      request.delete(`/api/v2${path}`, { headers: headers(version) }),
  };
}

type ApiClient = ReturnType<typeof client>;

const dateKey = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

test("API v2: an API key manages event types and schedules, and bookings go through the API", async ({
  page,
  request,
}) => {
  const { username } = await signUp(page);
  const key = await createApiKey(page);
  const api = client(request, key);
  const anonymous = client(request, null);

  const unauthorized = await anonymous.get("/me");
  expect(unauthorized.status()).toBe(401);
  expect(await unauthorized.json()).toMatchObject({
    status: "error",
    error: { code: "UnauthorizedException" },
  });
  expect((await client(request, "cal_0000").get("/me")).status()).toBe(401);

  const me = await api.patch("/me", { timeZone: "Europe/Rome", timeFormat: 24 });
  expect(await me.json()).toMatchObject({
    status: "success",
    data: { username, timeZone: "Europe/Rome", timeFormat: 24 },
  });
  expect((await api.patch("/me", { email: "new@example.com" })).status()).toBe(400);

  const schedule = await (
    await api.post(
      "/schedules",
      {
        name: "API hours",
        timeZone: "Europe/Rome",
        isDefault: false,
        availability: [
          {
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            startTime: "09:00",
            endTime: "17:00",
          },
        ],
      },
      "2024-06-11"
    )
  ).json();
  expect(schedule.data).toMatchObject({ name: "API hours", isDefault: false });
  const schedules = await (await api.get("/schedules", "2024-06-11")).json();
  expect(schedules.data.map((entry: { id: number }) => entry.id)).toContain(schedule.data.id);

  expect((await api.post("/event-types", { title: "x", slug: "x", lengthInMinutes: 30 })).status()).toBe(400);
  const slug = uniqueName("api-");
  const created = await api.post(
    "/event-types",
    {
      title: "API demo",
      slug,
      lengthInMinutes: 30,
      scheduleId: schedule.data.id,
      locations: [{ type: "link", link: "https://example.com/room", public: true }],
    },
    "2024-06-14"
  );
  expect(created.status()).toBe(201);
  const eventType = (await created.json()).data;
  expect(eventType).toMatchObject({
    slug,
    lengthInMinutes: 30,
    scheduleId: schedule.data.id,
    locations: [{ type: "link", link: "https://example.com/room", public: true }],
    bookingUrl: expect.stringContaining(`/${username}/${slug}`),
  });
  const listed = await (await anonymous.get(`/event-types?username=${username}`, "2024-06-14")).json();
  expect(listed.data.map((entry: { slug: string }) => entry.slug)).toContain(slug);

  await bookThroughApi(api, anonymous, eventType.id);
});

async function bookThroughApi(api: ApiClient, anonymous: ApiClient, eventTypeId: number) {
  const slots = await (
    await anonymous.get(
      `/slots?eventTypeId=${eventTypeId}&start=${dateKey(2)}&end=${dateKey(6)}&timeZone=Europe/Rome`,
      "2024-09-04"
    )
  ).json();
  const [firstDay, secondDay] = Object.keys(slots.data);
  const [first] = slots.data[firstDay];
  const [second] = slots.data[secondDay];
  expect(first.start).toMatch(/T09:00:00\.000\+0[12]:00$/);

  const created = await anonymous.post(
    "/bookings",
    {
      start: first.start,
      eventTypeId,
      attendee: { name: "Ada API", email: "ada.api@example.com", timeZone: "Europe/London", language: "en" },
      guests: ["guest.api@example.com"],
    },
    "2024-08-13"
  );
  expect(created.status()).toBe(201);
  const booking = (await created.json()).data;
  expect(booking).toMatchObject({
    status: "accepted",
    start: new Date(first.start).toISOString(),
    duration: 30,
    eventTypeId,
    location: "https://example.com/room",
    meetingUrl: "https://example.com/room",
    // Guests are attendees too, as in Cal.
    attendees: [
      { name: "Ada API", email: "ada.api@example.com", timeZone: "Europe/London", absent: false },
      { email: "guest.api@example.com", absent: false },
    ],
    guests: ["guest.api@example.com"],
  });

  const upcoming = await (await api.get("/bookings?status=upcoming&attendeeName=ada", "2024-08-13")).json();
  expect(upcoming.data.map((entry: { uid: string }) => entry.uid)).toEqual([booking.uid]);
  expect(upcoming.pagination).toMatchObject({ totalItems: 1, returnedItems: 1, hasNextPage: false });
  expect((await api.get("/bookings", "2024-08-13")).status()).toBe(200);
  expect((await anonymous.get("/bookings", "2024-08-13")).status()).toBe(401);

  const moved = (
    await (
      await anonymous.post(
        `/bookings/${booking.uid}/reschedule`,
        { start: second.start, reschedulingReason: "Clash" },
        "2024-08-13"
      )
    ).json()
  ).data;
  expect(moved).toMatchObject({
    status: "accepted",
    start: new Date(second.start).toISOString(),
    rescheduledFromUid: booking.uid,
  });
  const original = (await (await anonymous.get(`/bookings/${booking.uid}`, "2024-08-13")).json()).data;
  expect(original).toMatchObject({ status: "cancelled", rescheduledToUid: moved.uid });

  await changeThroughApi(api, anonymous, moved.uid);

  const cancelled = await api.post(
    `/bookings/${moved.uid}/cancel`,
    { cancellationReason: "No longer needed" },
    "2024-08-13"
  );
  expect((await cancelled.json()).data).toMatchObject({
    status: "cancelled",
    cancellationReason: "No longer needed",
  });
  const again = await api.post(`/bookings/${moved.uid}/cancel`, {}, "2024-08-13");
  expect(again.status()).toBe(409);
  expect(await again.json()).toMatchObject({ status: "error", error: { code: "ConflictException" } });
}

/** The host's own changes to a booking: guests, location and absences. */
async function changeThroughApi(api: ApiClient, anonymous: ApiClient, uid: string) {
  const withGuest = await api.post(
    `/bookings/${uid}/guests`,
    { guests: [{ email: "late.guest@example.com", name: "Late Guest" }] },
    "2024-08-13"
  );
  expect(withGuest.status()).toBe(200);
  expect((await withGuest.json()).data.attendees).toContainEqual(
    expect.objectContaining({ email: "late.guest@example.com" })
  );
  expect(
    (
      await anonymous.post(`/bookings/${uid}/guests`, { guests: [{ email: "x@example.com" }] }, "2024-08-13")
    ).status()
  ).toBe(401);

  const moved = await api.patch(
    `/bookings/${uid}/location`,
    { location: { type: "address", address: "1 Infinite Loop" } },
    "2024-08-13"
  );
  expect((await moved.json()).data).toMatchObject({ location: "1 Infinite Loop" });
  expect(
    (
      await api.patch(
        `/bookings/${uid}/location`,
        { location: { type: "attendeeDefined", location: "x" } },
        "2024-08-13"
      )
    ).status()
  ).toBe(400);

  // Nobody can be absent from a meeting that hasn't started, and host absences aren't tracked.
  const early = await api.post(
    `/bookings/${uid}/mark-absent`,
    { attendees: [{ email: "ada.api@example.com", absent: true }] },
    "2024-08-13"
  );
  expect(early.status()).toBe(400);
  expect((await api.post(`/bookings/${uid}/mark-absent`, { host: true }, "2024-08-13")).status()).toBe(400);
}

test("API v2: webhooks can be created, changed, listed and deleted", async ({ page, request }) => {
  await signUp(page);
  const api = client(request, await createApiKey(page));

  const created = await api.post("/webhooks", {
    subscriberUrl: "https://example.com/hooks/cal",
    triggers: ["BOOKING_CREATED", "BOOKING_CANCELLED"],
    active: true,
    secret: "s3cret",
  });
  expect(created.status()).toBe(201);
  const webhook = (await created.json()).data;
  expect(webhook).toMatchObject({ triggers: ["BOOKING_CREATED", "BOOKING_CANCELLED"], active: true });
  expect(webhook).not.toHaveProperty("secret");

  const updated = await (await api.patch(`/webhooks/${webhook.id}`, { active: false })).json();
  expect(updated.data).toMatchObject({
    id: webhook.id,
    active: false,
    subscriberUrl: "https://example.com/hooks/cal",
  });
  const listed = await (await api.get("/webhooks")).json();
  expect(listed.data.map((entry: { id: string }) => entry.id)).toEqual([webhook.id]);

  expect((await api.delete(`/webhooks/${webhook.id}`)).status()).toBe(200);
  expect((await api.get(`/webhooks/${webhook.id}`)).status()).toBe(404);
});
