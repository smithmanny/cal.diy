import process from "node:process";
import { createServerFn } from "@tanstack/react-start";

export const getAuthProviders = createServerFn({ method: "GET" }).handler(() => ({
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
}));
