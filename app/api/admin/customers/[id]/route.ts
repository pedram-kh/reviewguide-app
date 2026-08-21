import { NextResponse } from "next/server";

import { BackendApiError, patchCustomer, type CustomerPatchBody } from "@/lib/api";

/**
 * Server-side proxy for PATCH /api/admin/customers/{id} (ticket 6.18). Same shape as
 * app/api/leads/[id]/route.ts's proxy for PATCH /api/admin/leads/{id} — lib/api.ts is
 * `server-only` and holds ADMIN_API_KEY, so the Client Component toggle calls this same-origin
 * route instead of the backend directly.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ detail: `Invalid customer id: ${id}` }, { status: 400 });
  }

  let body: CustomerPatchBody;
  try {
    body = (await request.json()) as CustomerPatchBody;
  } catch {
    return NextResponse.json({ detail: "Request body must be JSON" }, { status: 400 });
  }

  try {
    const customer = await patchCustomer(customerId, body);
    return NextResponse.json(customer);
  } catch (err) {
    if (err instanceof BackendApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
