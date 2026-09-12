import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ data }, { status: init ?? 200 });
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { error: { message, code: code ?? String(status) } },
    { status }
  );
}

export function unauthorized(message = "You must be signed in.") {
  return apiError(message, 401, "UNAUTHORIZED");
}

export function forbidden(message = "You don't have access to this resource.") {
  return apiError(message, 403, "FORBIDDEN");
}

export function notFound(message = "Not found.") {
  return apiError(message, 404, "NOT_FOUND");
}

/** Wraps a route handler body, turning thrown Zod/known errors into consistent JSON responses. */
export async function handleApi(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed.",
            code: "VALIDATION_ERROR",
            issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        },
        { status: 422 }
      );
    }
    console.error(err);
    return apiError("Something went wrong. Please try again.", 500, "INTERNAL_ERROR");
  }
}
