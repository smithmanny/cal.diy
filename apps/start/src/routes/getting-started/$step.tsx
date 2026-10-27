import { createFileRoute, notFound, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { WEEKLY_HOURS_MESSAGE_KEYS } from "~/components/availability/WeeklyHoursEditor";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import {
  AvailabilityStep,
  CalendarStep,
  ProfileStep,
  UserSettingsStep,
} from "~/components/onboarding/OnboardingSteps";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getCalendarSettings } from "~/server/calendars/functions";
import {
  finishOnboarding,
  getOnboardingState,
  saveOnboardingUserSettings,
} from "~/server/onboarding/functions";
import { getSchedule, updateSchedule } from "~/server/schedules/functions";

// Cal's step slugs, so links into onboarding keep working.
const STEPS = ["user-settings", "connected-calendar", "setup-availability", "user-profile"] as const;
type Step = (typeof STEPS)[number];

const HEADINGS: Record<Step, [string, string]> = {
  "user-settings": ["welcome_to_cal_header", "we_just_need_basic_info"],
  "connected-calendar": ["connect_your_calendar", "connect_your_calendar_instructions"],
  "setup-availability": ["set_availability", "set_availability_getting_started_subtitle_1"],
  "user-profile": ["nearly_there", "nearly_there_instructions"],
};

const MESSAGE_KEYS = [
  ...Object.values(HEADINGS).flat(),
  ...WEEKLY_HOURS_MESSAGE_KEYS,
  "username",
  "full_name",
  "timezone",
  "next_step_text",
  "set_up_later",
  "connect",
  "google_calendar",
  "finish",
  "about",
  "few_sentences_about_yourself",
  "upload_avatar",
  "profile_picture",
  "username_already_taken",
  "invalid_timezone",
  "image_upload_error",
  "something_went_wrong",
  "overlapping_time_ranges",
  "error_end_time_before_start_time",
];

function StepContent({ step }: { step: Step }) {
  const { state, schedule, calendars } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();
  const goTo = (next: Step) => navigate({ to: "/getting-started/$step", params: { step: next } });
  switch (step) {
    case "user-settings":
      return (
        <UserSettingsStep
          initial={{ name: state.name ?? "", username: state.username ?? "", timeZone: state.timeZone }}
          save={(values) => saveOnboardingUserSettings({ data: values })}
          next={() => goTo("connected-calendar")}
        />
      );
    case "connected-calendar":
      return (
        <CalendarStep
          enabled={calendars.enabled}
          connections={calendars.connections}
          next={() => goTo("setup-availability")}
        />
      );
    case "setup-availability":
      if (!schedule) return null;
      return (
        <AvailabilityStep
          schedule={schedule}
          timeZone={state.timeZone}
          locale={locale}
          save={({ id, isDefault: _, ...input }) => updateSchedule({ data: { id, schedule: input } })}
          next={() => goTo("user-profile")}
        />
      );
    default:
      return (
        <ProfileStep
          initial={{ bio: state.bio ?? "", avatarUrl: state.avatarUrl }}
          finish={(values) => finishOnboarding({ data: values })}
          next={async () => {
            // The session's onboarding flag is re-read before leaving, so the app lets the user in.
            await router.invalidate();
            await navigate({ to: "/event-types" });
          }}
        />
      );
  }
}

function GettingStartedPage() {
  const { step } = Route.useParams();
  const t = useT();
  const index = STEPS.indexOf(step);
  const [title, subtitle] = HEADINGS[step];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl">{t(title, { appName: "Cal.diy" })}</h1>
        <p className="text-muted-foreground text-sm">{t(subtitle)}</p>
        <ol className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((name, position) => (
            <li
              key={name}
              className={`h-1 flex-1 rounded-full ${position <= index ? "bg-foreground" : "bg-muted"}`}
            />
          ))}
        </ol>
      </header>
      <HydratedFieldset>
        <div className="rounded-xl border bg-card p-6">
          <StepContent step={step} />
        </div>
      </HydratedFieldset>
    </main>
  );
}

export const Route = createFileRoute("/getting-started/$step")({
  params: {
    parse: ({ step }) => {
      if (!STEPS.includes(step as Step)) throw notFound();
      return { step: step as Step };
    },
    stringify: ({ step }) => ({ step }),
  },
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: "/auth/login", search: { callbackUrl: location.href } });
  },
  loader: async ({ context }) => {
    const [messages, state, calendars] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getOnboardingState(),
      getCalendarSettings(),
    ]);
    const schedule = state.defaultScheduleId
      ? await getSchedule({ data: { id: state.defaultScheduleId } })
      : null;
    return { messages, state, calendars, schedule };
  },
  component: GettingStartedPage,
});
