import process from "node:process";
import { createServerFn } from "@tanstack/react-start";
import { isEmailEnabled } from "../emails/container";

export const getAuthProviders = createServerFn({ method: "GET" }).handler(() => ({
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  // Password reset and verification links can only be offered when they can be delivered.
  email: isEmailEnabled(),
}));
