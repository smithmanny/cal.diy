import "@tanstack/react-start/server-only";

import type { z } from "zod";
import { createT } from "~/lib/i18n";
import { pickMessages } from "../catalog";
import { AppError } from "../errors";
import { type ApiUser, authenticate } from "./auth";

/** The header Cal's API v2 reads to pick an endpoint's request and response shapes. */
const CAL_API_VERSION_HEADER = "cal-api-version";

/** Cal's `PaginationMetaDto`. */
type Pagination = {
  totalItems: number;
  remainingItems: number;
  returnedItems: number;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/** A list endpoint's result: Cal sends `pagination` next to `data`. */
class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly pagination: Pagination
  ) {}
}

/** Answers with this status instead of 200 (Cal's create endpoints answer 201). */
class WithStatus<T> {
  constructor(
    readonly status: number,
    readonly data: T
  ) {}
}

type Handler<Auth> = (context: {
  request: Request;
  url: URL;
  params: Record<string, string>;
  user: Auth;
}) => Promise<unknown>;

type RouteArgs = { request: Request; params: Record<string, string> };

/** Nest's exception names, which Cal's API sends as `error.code`. */
const ERROR_NAMES: Record<number, string> = {
  400: "BadRequestException",
  401: "UnauthorizedException",
  403: "ForbiddenException",
  404: "NotFoundException",
  409: "ConflictException",
  429: "ThrottlerException",
  500: "InternalServerErrorException",
};

/** Thrown for malformed input; its message is shown to the API client as is. */
class ApiInputError extends Error {}

function errorResponse(request: Request, status: number, message: string, details?: unknown): Response {
  return Response.json(
    {
      status: "error",
      timestamp: new Date().toISOString(),
      path: new URL(request.url).pathname,
      error: { code: ERROR_NAMES[status] ?? ERROR_NAMES[500], message, ...(details ? { details } : {}) },
    },
    { status }
  );
}

async function englishMessage(error: AppError): Promise<string> {
  const messages = await pickMessages("en", [error.code]);
  return createT(messages)(error.code, error.values);
}

async function toErrorResponse(request: Request, error: unknown): Promise<Response> {
  if (error instanceof ApiInputError) return errorResponse(request, 400, error.message);
  if (error instanceof AppError) return errorResponse(request, error.status, await englishMessage(error));
  console.error("API v2 request failed", error);
  return errorResponse(request, 500, "Internal server error");
}

function successResponse(result: unknown): Response {
  if (result instanceof Response) return result;
  if (result instanceof WithStatus)
    return Response.json({ status: "success", data: result.data }, { status: result.status });
  if (result instanceof Paginated)
    return Response.json({ status: "success", data: result.items, pagination: result.pagination });
  return Response.json({ status: "success", data: result ?? null });
}

async function respond(request: Request, run: () => Promise<unknown>): Promise<Response> {
  try {
    return successResponse(await run());
  } catch (error) {
    return toErrorResponse(request, error);
  }
}

function requireVersion(request: Request, version: string | undefined): void {
  if (!version) return;
  const sent = request.headers.get(CAL_API_VERSION_HEADER);
  // Cal routes other versions to older controllers whose shapes this app doesn't serve.
  if (sent !== version)
    throw new ApiInputError(`This endpoint needs the header "${CAL_API_VERSION_HEADER}: ${version}".`);
}

/** An endpoint that needs an API key. */
function apiRoute(handler: Handler<ApiUser>, options: { version?: string } = {}) {
  return ({ request, params }: RouteArgs) =>
    respond(request, async () => {
      requireVersion(request, options.version);
      const user = await authenticate(request);
      if (!user) throw new AppError("unauthorized", 401);
      return handler({ request, url: new URL(request.url), params, user });
    });
}

/** An endpoint anyone may call, which treats the API key's owner as the signed-in user. */
function publicApiRoute(handler: Handler<ApiUser | null>, options: { version?: string } = {}) {
  return ({ request, params }: RouteArgs) =>
    respond(request, async () => {
      requireVersion(request, options.version);
      return handler({ request, url: new URL(request.url), params, user: await authenticate(request) });
    });
}

function formatIssues(error: z.ZodError): string {
  // Cal's ZodExceptionFilter format: "path - message" per issue.
  return error.issues.map((issue) => `${issue.path.join(".") || "body"} - ${issue.message}`).join(", ");
}

function parseInput<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiInputError(formatIssues(parsed.error));
  return parsed.data;
}

async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiInputError("The request body must be JSON.");
  }
  return parseInput(schema, body);
}

/** Query values, with comma-separated lists (Cal's `?status=upcoming,past`) left as strings. */
function parseQuery<T extends z.ZodTypeAny>(url: URL, schema: T): z.infer<T> {
  return parseInput(schema, Object.fromEntries(url.searchParams));
}

function parseId(value: string | undefined, name: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiInputError(`${name} must be a positive integer.`);
  return id;
}

function pagination(total: number, take: number, skip: number, returned: number): Pagination {
  const totalPages = Math.ceil(total / take);
  const currentPage = Math.floor(skip / take) + 1;
  return {
    totalItems: total,
    remainingItems: Math.max(total - skip - returned, 0),
    returnedItems: returned,
    itemsPerPage: take,
    currentPage,
    totalPages,
    hasNextPage: skip + returned < total,
    hasPreviousPage: skip > 0,
  };
}

export type { Pagination };
export {
  CAL_API_VERSION_HEADER,
  Paginated,
  WithStatus,
  ApiInputError,
  apiRoute,
  pagination,
  parseBody,
  parseId,
  parseInput,
  parseQuery,
  publicApiRoute,
  respond,
};
