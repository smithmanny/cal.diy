import { describe, expect, it } from "vitest";
import { AppError } from "../server/errors";
import { errorMessageKey, errorMessageValues } from "./errors";

describe("app error messages", () => {
  it("round-trips a translation key and its values", () => {
    const error = new AppError("booker_upcoming_limit_reached", 409, { count: 2 });
    expect(errorMessageKey(error)).toBe("booker_upcoming_limit_reached");
    expect(errorMessageValues(error)).toEqual({ count: 2 });
    expect(errorMessageValues(new AppError("not_found"))).toBeUndefined();
  });

  it("hides anything that isn't an AppError message", () => {
    expect(errorMessageKey(new Error("SQLITE_ERROR: no such table"))).toBe("something_went_wrong");
    expect(errorMessageValues(new Error("SQLITE_ERROR: no such table"))).toBeUndefined();
  });
});
