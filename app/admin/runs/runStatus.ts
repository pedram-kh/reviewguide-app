import type { PollRunListItem } from "@/lib/api";

// A run in flight and a run that died both have finished_at = null; nothing in the row itself
// distinguishes them. Age does: the poller takes tens of seconds under real work, so anything
// still unfinished after this long is not running, it is gone. Generous on purpose — calling a
// live run "crashed" is a worse error than being slow to call a crashed one crashed.
const STILL_RUNNING_GRACE_MS = 15 * 60 * 1000;

export interface RunStatus {
  label: string;
  badgeClass: string;
  // Drives the red row highlight: something here needs a human, not just a number to read.
  alarming: boolean;
}

export function runStatus(run: PollRunListItem, now: number = Date.now()): RunStatus {
  if (run.finished_at === null) {
    const age = now - new Date(run.started_at).getTime();
    if (age < STILL_RUNNING_GRACE_MS) {
      return { label: "running", badgeClass: "bg-blue-100/80 text-blue-700", alarming: false };
    }
    return {
      label: "did not finish",
      badgeClass: "bg-red-100/80 text-red-700",
      alarming: true,
    };
  }
  if (run.aborted) {
    return { label: "aborted", badgeClass: "bg-red-100/80 text-red-700", alarming: true };
  }
  if (run.skipped > 0) {
    return { label: "capped", badgeClass: "bg-amber-100/80 text-amber-700", alarming: true };
  }
  if (run.error_note !== null) {
    // A finished, un-aborted run with a note is the outside-the-window skip — worth seeing,
    // since EventBridge should never produce one, but not worth alarming about.
    return { label: run.error_note, badgeClass: "bg-zinc-100/80 text-zinc-500", alarming: false };
  }
  return { label: "ok", badgeClass: "bg-emerald-100/80 text-emerald-700", alarming: false };
}
