import "@tanstack/react-start/server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import type { Database } from "@calcom/db/database";
import { createLibsqlDatabase, migrateLibsqlDatabase } from "@calcom/db/drivers/libsql";
import { IS_PRODUCTION_BUILD } from "../build";
import type { EmailMessage, EmailSender } from "../emails/sender";

// The server is bundled into dist/, so resolve from the working directory (apps/web, or /app in Docker).
const DEFAULT_MIGRATIONS_DIR = resolve(process.cwd(), "../../packages/db/migrations");
const STATIC_DIR = resolve(process.cwd(), IS_PRODUCTION_BUILD ? "dist/client" : "public");

let dbPromise: Promise<Database> | undefined;

/** server.node.mjs sets this from the socket (or a trusted proxy), overwriting any client value. */
export const CLIENT_IP_HEADERS = ["x-cal-client-ip"];

async function init(): Promise<Database> {
  const options = {
    url: process.env.DATABASE_URL ?? "file:./data/cal.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  };
  // Self-hosted installs have no separate deploy step, so the schema is brought up to date
  // on boot. Set RUN_MIGRATIONS=false to manage migrations yourself.
  if (process.env.RUN_MIGRATIONS !== "false") {
    await migrateLibsqlDatabase(options, process.env.MIGRATIONS_DIR ?? DEFAULT_MIGRATIONS_DIR);
  }
  return createLibsqlDatabase(options);
}

export function getDb(): Promise<Database> {
  dbPromise ??= init().catch((error) => {
    dbPromise = undefined;
    throw error;
  });
  return dbPromise;
}

/** Reads a file from the static assets (public/) bundle, or null when it doesn't exist. */
export async function readStaticAsset(path: string): Promise<string | null> {
  const file = resolve(STATIC_DIR, path);
  if (!file.startsWith(STATIC_DIR)) return null;
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

/** The Node process outlives the request, so the work just continues after the response. */
export function runInBackground(promise: Promise<unknown>): void {
  void promise.catch((error) => console.error("Background task failed", error));
}

/** SMTP using Cal's EMAIL_SERVER_* variables; Node only, as Workers can't open SMTP sockets. */
export function createSmtpSender(): EmailSender | null {
  const host = process.env.EMAIL_SERVER_HOST;
  if (!host) return null;
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 587);
  const transportPromise = import("nodemailer").then(({ createTransport }) =>
    createTransport({
      host,
      port,
      secure: port === 465,
      auth: process.env.EMAIL_SERVER_USER
        ? { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD }
        : undefined,
    })
  );
  return async (message: EmailMessage) => {
    const transport = await transportPromise;
    await transport.sendMail({
      from: message.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  };
}
