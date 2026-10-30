import { adminClient, inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "~/server/auth/createAuth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), twoFactorClient(), adminClient()],
});
