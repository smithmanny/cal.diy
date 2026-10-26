import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { UserRepository } from "../users/UserRepository";

export async function getUserRepository(): Promise<UserRepository> {
  return new UserRepository(await getDb());
}
