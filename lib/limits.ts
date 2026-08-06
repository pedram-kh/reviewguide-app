// LOGIC.md §6: "10-20 messages/day maximum, no bursts." Mirrors the backend's
// MAX_SENDS_PER_DAY (app/routers/admin.py, ticket 3.4) — the backend is the actual
// enforcement point (429 on PATCH -> sent); this only drives the dashboard's own N/20
// counter and pre-emptively disabling "Mark sent" in the UI.
export const MAX_SENDS_PER_DAY = 20;
