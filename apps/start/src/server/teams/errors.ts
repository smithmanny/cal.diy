import "@tanstack/react-start/server-only";
import { APIError } from "better-auth/api";
import { AppError } from "../errors";

// Better Auth's organization error codes, as translation keys the client shows.
const TEAM_ERROR_KEYS: Record<string, string> = {
  ORGANIZATION_ALREADY_EXISTS: "team_url_taken",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "team_url_taken",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "already_a_member",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "member_already_invited",
  INVITATION_NOT_FOUND: "invitation_not_found",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "invitation_not_found",
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: "verify_email_to_join_team",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: "team_needs_an_owner",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: "team_needs_an_owner",
  ORGANIZATION_NOT_FOUND: "team_not_found",
  MEMBER_NOT_FOUND: "not_found",
};

export const TEAM_ERROR_MESSAGE_KEYS = [...new Set(Object.values(TEAM_ERROR_KEYS)), "unauthorized"];

/** Runs a Better Auth organization call, turning its errors into translated AppErrors. */
export async function withTeamErrors<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    const code = typeof error.body?.code === "string" ? error.body.code : "";
    if (TEAM_ERROR_KEYS[code]) throw new AppError(TEAM_ERROR_KEYS[code], 409);
    // Every other refusal is a permission check ("you are not allowed to …").
    if (error.statusCode === 403 || error.statusCode === 401) throw new AppError("unauthorized", 403);
    throw error;
  }
}
