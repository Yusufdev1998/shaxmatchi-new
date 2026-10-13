import { studentExamsApi, type ExamAttemptFailDetail } from "../api/studentExamsApi";
import { getAuthToken } from "../auth/auth";
import { queryClient } from "../queryClient";

/** localStorage keys for an exam attempt: mid-attempt progress, and a verdict not yet delivered. */
export const examProgressKey = (attemptId: string) => `examProgress:${attemptId}`;
export const examResultKey = (attemptId: string) => `examResult:${attemptId}`;

const RESULT_PREFIX = "examResult:";

type PendingResult = { result: "passed" | "failed"; failDetails?: ExamAttemptFailDetail[] };

const inFlight = new Set<string>();

function pendingResults(): Array<{ attemptId: string; args: PendingResult }> {
  const found: Array<{ attemptId: string; args: PendingResult }> = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(RESULT_PREFIX)) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as
          | Partial<PendingResult>
          | null;
        if (parsed?.result !== "passed" && parsed?.result !== "failed") continue;
        found.push({
          attemptId: key.slice(RESULT_PREFIX.length),
          args: {
            result: parsed.result,
            failDetails: Array.isArray(parsed.failDetails) ? parsed.failDetails : undefined,
          },
        });
      } catch {
        /* corrupt entry — skip */
      }
    }
  } catch {
    /* storage unavailable */
  }
  return found;
}

/**
 * Deliver every exam verdict that was decided on this device but never reached the server.
 * The exam page does this for its own attempt; this covers the student who left the page,
 * closed the app or lost the connection before the verdict went through — otherwise the
 * attempt would sit `in_progress` until the server gave up on it. Finalize is idempotent
 * server-side, so racing with the exam page is harmless.
 */
export async function flushPendingExamResults(): Promise<void> {
  if (!getAuthToken()) return;
  for (const { attemptId, args } of pendingResults()) {
    if (inFlight.has(attemptId)) continue;
    inFlight.add(attemptId);
    try {
      await studentExamsApi.finalizeAttempt(attemptId, args.result, args.failDetails);
      try {
        window.localStorage.removeItem(examResultKey(attemptId));
        window.localStorage.removeItem(examProgressKey(attemptId));
      } catch {
        /* ignore */
      }
      void queryClient.invalidateQueries({ queryKey: ["studentExams"] });
      void queryClient.invalidateQueries({ queryKey: ["studentExam"] });
    } catch {
      /* still offline or server down — the next trigger will try again */
    } finally {
      inFlight.delete(attemptId);
    }
  }
}

/** Flush now, and again whenever connectivity or visibility comes back. */
export function startExamResultFlusher(): void {
  void flushPendingExamResults();
  window.addEventListener("online", () => void flushPendingExamResults());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushPendingExamResults();
  });
}
