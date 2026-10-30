// ORM-agnostic inputs for availability computation. Times of day are Dates whose UTC hours/minutes
// carry the wall-clock time (the convention Cal has always used for Availability.startTime/endTime).

export type WorkingHours = { days: number[]; startTime: Date; endTime: Date };

export type DateOverride = { date: Date | null; startTime: Date; endTime: Date };

export type FromUser = { id: number; displayName: string | null };

export type ToUser = { id: number; username: string | null; displayName: string | null };

/** Out-of-office entries keyed by YYYY-MM-DD. */
export type OutOfOfficeData = {
  [date: string]: {
    fromUser: FromUser | null;
    toUser?: ToUser | null;
    reason?: string | null;
    emoji?: string | null;
    notes?: string | null;
    showNotePublicly?: boolean;
  };
};
