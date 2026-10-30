import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessageKey } from "~/lib/errors";

/** Runs a team change, reloads the page's data, and keeps the error to show. */
export function useTeamAction() {
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setErrorKey(null);
    try {
      await action();
      await router.invalidate();
      return true;
    } catch (error) {
      setErrorKey(errorMessageKey(error));
      return false;
    }
  }
  return { run, errorKey };
}
