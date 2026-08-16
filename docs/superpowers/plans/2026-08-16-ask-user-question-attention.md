# AskUserQuestion Attention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface active threads waiting on an `AskUserQuestion` and refresh the attention section as interactions are created or resolved.

**Architecture:** Keep the existing snapshot and ranking model. Broaden interaction discovery to active threads when the summary flag is unavailable, and subscribe to BB thread change notifications so the frontend receives a refresh signal for `interactions-changed`. Preserve the existing semantic badge colors for error, interaction, and unread statuses.

**Tech Stack:** TypeScript, Zod, Vitest, `@get-bb/plugin-sdk` fake plugin host.

## Global Constraints

- Keep hidden, archived, deleted, and actively running threads without a pending interaction out of the list.
- Keep interaction ranking between errors and unread turns.
- Do not scan every thread's interactions when the thread is idle and has no pending-interaction flag.
- Use the existing host theme tokens and status badge classes.

### Task 1: Add regression coverage for active AskUserQuestion discovery

**Files:**
- Modify: `server.test.ts`

- [x] Add a test fixture where an active visible thread has `hasPendingInteraction: false`, while `threads.interactions.list` returns a pending `user_question`; assert it appears as an `interaction` item with the question prompt.
- [x] Run `npm test -- server.test.ts`; confirm the new test fails because the current snapshot skips active threads whose summary flag is false.

### Task 2: Implement targeted active-thread interaction lookup

**Files:**
- Modify: `server.ts`

- [x] Change the interaction candidate condition to `thread.hasPendingInteraction || thread.status === "active"`.
- [x] Leave unread fallback restricted to idle threads, so an active thread with no pending interaction remains excluded.
- [x] Run `npm test -- server.test.ts`; confirm the regression and existing ranking tests pass.

### Task 3: Refresh attention on interaction lifecycle changes

**Files:**
- Modify: `server.ts`
- Modify: `server.test.ts`

- [x] Register a background service that subscribes to `bb.sdk.subscribe({ event: "thread:changed" })`.
- [x] Publish `attention-changed` only when the event’s `changes` contains `interactions-changed`; include the changed thread id.
- [x] Ensure the service unsubscribes when aborted.
- [x] Add a fake-host service test that captures the subscription callback, invokes it for interaction and non-interaction changes, and asserts only the interaction change publishes a signal.
- [x] Run `npm test -- server.test.ts`; confirm all focused tests pass.

### Task 4: Verify status colors and project health

**Files:**
- Inspect: `app.css`
- Inspect: `app.tsx`

- [x] Verify the existing `attention-badge-error`, `attention-badge-interaction`, and `attention-badge-unread` classes remain wired to the item kind.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Review `git diff` for scope, generated artifacts, and accidental formatting changes.
