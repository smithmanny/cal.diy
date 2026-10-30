import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { OnboardingRepository } from "./OnboardingRepository";
import { OnboardingService } from "./OnboardingService";

export async function getOnboardingRepository(): Promise<OnboardingRepository> {
  return new OnboardingRepository(await getDb());
}

export async function getOnboardingService(): Promise<OnboardingService> {
  return new OnboardingService({ repo: await getOnboardingRepository() });
}
