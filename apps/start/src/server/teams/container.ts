import "@tanstack/react-start/server-only";
import { getDb } from "../db";
import { TeamRepository } from "./TeamRepository";
import { TeamService } from "./TeamService";

export async function getTeamService(): Promise<TeamService> {
  return new TeamService({ teamRepo: new TeamRepository(await getDb()) });
}
