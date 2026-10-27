import { createFileRoute } from "@tanstack/react-router";
import { redirectOutOfEmbedPath } from "~/lib/embed-redirect";

export const Route = createFileRoute("/booking/$uid_/embed")({
  beforeLoad: ({ location }) => redirectOutOfEmbedPath(location),
});
