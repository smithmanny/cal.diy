import { createFileRoute, redirect } from "@tanstack/react-router";

/** NextAuth's sign-in URL, still in old links and bookmarks. */
export const Route = createFileRoute("/auth/signin")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: `/auth/login${location.searchStr}`, statusCode: 301 });
  },
});
