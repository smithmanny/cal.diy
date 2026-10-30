import type { Database } from "@calcom/db/database";
import { booking, eventType, host, membership, team, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { EventTypeRepository } from "../event-types/EventTypeRepository";
import { HolidayRepository } from "../holidays/HolidayRepository";
import { HolidayService } from "../holidays/HolidayService";
import { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { ScheduleService } from "../schedules/ScheduleService";
import { DEFAULT_WEEKLY_HOURS } from "../schedules/scheduleMapper";
import { TeamRepository } from "../teams/TeamRepository";
import { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import { UserRepository } from "../users/UserRepository";
import { BookingRepository } from "./BookingRepository";
import { BookingService } from "./BookingService";
import { TeamEventLoader } from "./teamEvents";

let db: Database;
let service: BookingService;
let ana: number;
let ben: number;
let teamId: number;

// Monday 2030-01-07; both members work 9-17 UTC.
const MONDAY = "2030-01-07";
const at = (time: string) => `${MONDAY}T${time}:00.000Z`;

async function member(email: string, username: string) {
  const [{ id }] = await db
    .insert(user)
    .values({ email, username, name: username, timeZone: "UTC" })
    .returning({ id: user.id });
  await new ScheduleService({
    scheduleRepo: new ScheduleRepository(db),
    userRepo: new UserRepository(db),
  }).create(id, {
    name: "Work",
    timeZone: "UTC",
    weeklyHours: DEFAULT_WEEKLY_HOURS,
    dateOverrides: [],
  });
  await db.insert(membership).values({ teamId, userId: id, role: "MEMBER", accepted: true });
  return id;
}

beforeEach(async () => {
  db = await createTestDb();
  [{ id: teamId }] = await db
    .insert(team)
    .values({ name: "Sales", slug: "sales" })
    .returning({ id: team.id });
  ana = await member("ana@example.com", "ana");
  ben = await member("ben@example.com", "ben");
  const [collective, roundRobin] = await db
    .insert(eventType)
    .values([
      {
        teamId,
        title: "Panel",
        slug: "panel",
        length: 60,
        minimumBookingNotice: 0,
        schedulingType: "COLLECTIVE",
      },
      {
        teamId,
        title: "Demo",
        slug: "demo",
        length: 60,
        minimumBookingNotice: 0,
        schedulingType: "ROUND_ROBIN",
      },
    ])
    .returning({ id: eventType.id });
  await db.insert(host).values([
    { eventTypeId: collective.id, userId: ana, priority: 0 },
    { eventTypeId: collective.id, userId: ben, priority: 1 },
    { eventTypeId: roundRobin.id, userId: ana, priority: 0 },
    { eventTypeId: roundRobin.id, userId: ben, priority: 1 },
  ]);
  const userRepo = new UserRepository(db);
  const eventTypeRepo = new EventTypeRepository(db);
  const teamRepo = new TeamRepository(db);
  service = new BookingService({
    userRepo,
    eventTypeRepo,
    teamRepo,
    teamEvents: new TeamEventLoader({ teamRepo, eventTypeRepo, userRepo }),
    scheduleRepo: new ScheduleRepository(db),
    bookingRepo: new BookingRepository(db),
    travelScheduleRepo: new TravelScheduleRepository(db),
    oooRepo: new OutOfOfficeRepository(db),
    holidayService: new HolidayService({ repo: new HolidayRepository(db), fetchHolidays: null }),
  });
});

const slots = (slug: string) =>
  service
    .getAvailableSlots({
      username: "team:sales",
      slug,
      from: at("00:00"),
      to: `${MONDAY}T23:59:00.000Z`,
      timeZone: "UTC",
    })
    .then((result) => result.slots);

const book = (slug: string, start: string, email = "guest@example.com") =>
  service.create({
    username: "team:sales",
    slug,
    start,
    timeZone: "UTC",
    locale: "en",
    responses: { name: "Guest", email },
  });

/** Ben is busy 10-11 with another booking of his own. */
async function benBusyAtTen() {
  await db.insert(booking).values({
    uid: "busy",
    userId: ben,
    title: "Busy",
    startTime: new Date(at("10:00")),
    endTime: new Date(at("11:00")),
    status: "ACCEPTED",
  });
}

describe("team event types", () => {
  it("lists the team's page with its event types", async () => {
    const profile = await service.getProfile("team:sales");
    expect(profile.host.name).toBe("Sales");
    expect(profile.eventTypes.map((entry) => entry.slug).sort()).toEqual(["demo", "panel"]);
  });

  it("offers collective times only when every host is free, and books them all", async () => {
    await benBusyAtTen();
    expect(await slots("panel")).not.toContain(at("10:00"));
    const created = await book("panel", at("09:00"));
    const [row] = await db
      .select({ userId: booking.userId })
      .from(booking)
      .where(eq(booking.uid, created.uid));
    expect(row.userId).toBe(ana);
    const found = await new BookingRepository(db).findByUid(created.uid);
    expect(found?.attendees.map((entry) => entry.email)).toContain("ben@example.com");
  });

  it("offers round robin times when anyone is free, and gives them to whoever is", async () => {
    await benBusyAtTen();
    expect(await slots("demo")).toContain(at("10:00"));
    const atTen = await book("demo", at("10:00"));
    const [tenRow] = await db
      .select({ userId: booking.userId })
      .from(booking)
      .where(eq(booking.uid, atTen.uid));
    expect(tenRow.userId).toBe(ana);
  });

  it("spreads round robin bookings to the host booked least recently", async () => {
    const first = await book("demo", at("13:00"), "one@example.com");
    const second = await book("demo", at("14:00"), "two@example.com");
    const owners = await Promise.all(
      [first, second].map(async ({ uid }) => {
        const [row] = await db.select({ userId: booking.userId }).from(booking).where(eq(booking.uid, uid));
        return row.userId;
      })
    );
    expect(new Set(owners)).toEqual(new Set([ana, ben]));
  });

  it("refuses a round robin time nobody has free", async () => {
    await expect(book("demo", "2030-01-12T10:00:00.000Z")).rejects.toMatchObject({
      code: expect.any(String),
    });
  });
});
