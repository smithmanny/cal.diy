import { drizzle } from "drizzle-orm/d1";
import { type Database, schema } from "../database";

export function createD1Database(binding: D1Database): Database {
  return drizzle(binding, { schema });
}
