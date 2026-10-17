"use client";
import { useEffect, useRef, useState } from "react";
import { reviewRequest } from "./request";
import { postReviewDecision } from "./post-decision";
import { loadReviewSnapshot } from "./load-snapshot";
import {
  type ReviewInput,
  type ReviewRequest,
  type ReviewSummary,
} from "./types";
export function useReview(getToken: () => Promise<string | null>) {
  const token = useRef(getToken);
  const lifetime = useRef<AbortController | null>(null);
  const serial = useRef(0);
  const [rows, setRows] = useState<ReviewSummary[]>([]);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof loadReviewSnapshot>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    token.current = getToken;
  }, [getToken]);
  const request: ReviewRequest = (path, init) => {
    if (!lifetime.current) throw new Error("Review unavailable.");
    return reviewRequest(() => token.current(), lifetime.current.signal)(
      path,
      init,
    );
  };
  async function run(
    work: (request: ReviewRequest, live: () => boolean) => Promise<void>,
  ) {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted) return;
    const version = ++serial.current;
    const live = () =>
      controller === lifetime.current &&
      !controller.signal.aborted &&
      version === serial.current;
    setBusy(true);
    setError(null);
    try {
      await work(
        reviewRequest(() => token.current(), controller.signal),
        live,
      );
    } catch (e) {
      if (live()) {
        setDetail(null);
        setRows([]);
        setError(e instanceof Error ? e.message : "Review unavailable.");
      }
    } finally {
      if (live()) setBusy(false);
    }
  }
  async function refresh() {
    setDetail(null);
    await run(async (fetcher, live) => {
      const data = (await (
        await fetcher("/api/admin/pdf-imports/reviews")
      ).json()) as { reviews: ReviewSummary[] };
      if (live()) setRows(data.reviews);
    });
  }
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void refresh();
    return () => {
      controller.abort();
    };
    // The parent keys this component to one authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function select(id: string) {
    setDetail(null);
    await run(async (fetcher, live) => {
      const result = await loadReviewSnapshot(fetcher, id);
      if (live()) setDetail(result);
    });
  }
  async function decide(input: ReviewInput) {
    if (!detail || busy || input.validationId !== detail.snapshot.validationId)
      return;
    await run(async (fetcher, live) => {
      const result = await postReviewDecision(
        fetcher,
        detail.snapshot.operationId,
        input,
      );
      if (live()) setDetail({ ...detail, snapshot: result });
    });
  }
  return { rows, detail, busy, error, refresh, select, decide, request };
}
