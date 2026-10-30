export type VideoMeetingInput = {
  uid: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendees: { name: string; email: string }[];
};

export type VideoMeeting = { id: string; url: string; password: string | null };

export interface VideoClient {
  createMeeting(input: VideoMeetingInput): Promise<VideoMeeting>;
  deleteMeeting(meetingId: string): Promise<void>;
}

/** A conferencing app that creates a meeting per booking. */
export type VideoProvider = {
  /** Credential.type and BookingReference.type. */
  type: string;
  /** EventType.locations[].type that asks for this app. */
  locationType: string;
  /** Whether the host must have installed the app (a credential); Cal Video is instance-wide. */
  needsCredential: boolean;
  open(key: unknown, onKeyChange: (key: unknown) => Promise<void>): VideoClient;
  exchangeCode?(code: string): Promise<unknown>;
  /** The link people get, when it isn't the meeting's own (Cal Video goes through /video/<uid>). */
  publicLink?(bookingUid: string): string;
};
