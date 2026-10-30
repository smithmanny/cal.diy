import { createFileRoute } from "@tanstack/react-router";
import { redirectOutOfEmbedPath } from "~/lib/embed-redirect";

export const Route = createFileRoute("/$username/embed")({
  beforeLoad: ({ location }) => redirectOutOfEmbedPath(location),
});
