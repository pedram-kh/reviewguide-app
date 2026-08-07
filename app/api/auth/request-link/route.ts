import { NextResponse } from "next/server";

import { AuthApiError, requestMagicLink } from "@/lib/authApi";

/**
 * Proxies the /signup + /login forms' email submission to the backend (SPRINT_04.md ticket
 * 4.2). A Route Handler rather than a direct client-side fetch to BACKEND_URL for the same
 * reason lib/api.ts's admin calls never go straight from the browser: this app's server is the
 * only thing that talks to the backend.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let email: unknown;
  try {
    const body = (await request.json()) as { email?: unknown };
    email = body.email;
  } catch {
    return NextResponse.json({ detail: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  if (typeof email !== "string" || !email) {
    return NextResponse.json({ detail: "Adres e-mail jest wymagany." }, { status: 400 });
  }

  try {
    const result = await requestMagicLink(email);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    return NextResponse.json({ detail: "Coś poszło nie tak. Spróbuj ponownie." }, { status: 502 });
  }
}
