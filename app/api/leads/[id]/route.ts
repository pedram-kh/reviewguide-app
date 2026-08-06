import { NextResponse } from "next/server";

import { BackendApiError, patchLead, type LeadPatchBody } from "@/lib/api";

/**
 * Server-side proxy for PATCH /api/admin/leads/{id} (ticket 3.3). Client Components (Save,
 * Mark sent, Skip, notes autosave) call this same-origin route instead of the backend directly
 * — lib/api.ts is `server-only` and holds ADMIN_API_KEY, so it can only run here, never in the
 * browser bundle.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) {
    return NextResponse.json({ detail: `Invalid lead id: ${id}` }, { status: 400 });
  }

  let body: LeadPatchBody;
  try {
    body = (await request.json()) as LeadPatchBody;
  } catch {
    return NextResponse.json({ detail: "Request body must be JSON" }, { status: 400 });
  }

  try {
    const lead = await patchLead(leadId, body);
    return NextResponse.json(lead);
  } catch (err) {
    if (err instanceof BackendApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
