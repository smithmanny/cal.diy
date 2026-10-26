import { createServerFn } from "@tanstack/react-start";
// Only referenced inside the handler, so the server-only catalog code stays out of the client bundle.
import { pickMessages } from "./catalog";

export const getMessages = createServerFn({ method: "GET" })
  .validator((input: { locale: string; keys: readonly string[] }) => input)
  .handler(({ data }) => pickMessages(data.locale, data.keys));
