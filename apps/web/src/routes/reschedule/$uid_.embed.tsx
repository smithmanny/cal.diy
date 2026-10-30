import { createFileRoute } from "@tanstack/react-router";
import { redirectOutOfEmbedPath } from "~/lib/embed-redirect";

export const Route = createFileRoute("/reschedule/$uid_/embed")({
  beforeLoad: ({ location }) => redirectOutOfEmbedPath(location),
});
