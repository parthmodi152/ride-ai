# Swapping Uber for a Different Marketplace

## Architecture

The system has three layers that never reference each other's internals: the agent loop (`streamText` with a system prompt and tool set), the tool layer (four Zod-typed tools created via `createRideTools(adapter)`), and the platform adapter (a `PlatformAdapter` interface with normalized response types). Two design decisions make this swappable. First, every tool delegates to `adapter.method()` and never calls a platform API directly. Second, `bookRide` and `cancelRide` have no `execute` function, making the HITL confirmation flow entirely platform-agnostic.

## Swapping the Platform

**Same domain (Lyft).** One new file: a `LyftAdapter` implementing `PlatformAdapter`. The four methods translate Lyft's API shapes into our normalized types (Lyft's `ride_id` to our `tripId`, `Lux` to `premium`, Prime Time percentage to `surgeMultiplier`). One line in `registry.ts`. The client sends `{ platform: "lyft" }`. All tools, the HITL flow, action log, and UI are unchanged.

**Different domain (doctor appointments).** Same-domain swaps are zero-change beyond the adapter. Cross-domain swaps require one additional step: the response types (`ProductEstimate`, `BookingResult`, `TripStatus`) currently carry ride-specific fields like `surgeMultiplier`, `fareExpiresAt`, and `driver`. The path forward is generalizing these to domain-neutral fields (`options`, `price`/`priceDisplay`, `available`, `statusLabel`) with an untyped `metadata` bag for domain-specific details (surge for rides, copay for appointments, insurance status for healthcare). The tool layer, HITL flow, and action log stay untouched. The agent's natural language adapts based on what the adapter puts in metadata.

## What Breaks First in Production

- **Global state, no user or thread isolation.** Action log, trip history, and telemetry share single Redis keys. Two concurrent users see each other's data.
- **No marketplace auth layer.** Real Uber/Lyft APIs require per-user OAuth with token refresh. The adapter interface has no concept of credentials.
- **No agent guardrails.** No prompt injection protection, no output validation against tool results, no content moderation, and the system prompt is extractable.
- **Domain-specific types.** Response types encode ride-hailing assumptions. Cross-domain swaps need the generalized types + metadata bag described above.

## Other Constraints

- No auth on API routes. No rate limiting or per-user cost controls.
- No alerting; logs and telemetry exist but nothing pages on failure.
- No booking concurrency control; concurrent requests could double-book.
- Single LLM provider with no fallback or circuit breaker.
- GPT-4o-mini with a 5-step limit; complex flows can exhaust step budget or context window.

## Good to Have

- User-scoped memory for saved locations, preferred ride type, and payment defaults.
- Conversation persistence to resume threads across sessions.
- Eval suite and integration tests before deploying agent or model changes.
- Conversation persistence to resume threads across sessions.
- Eval suite and integration tests before deploying agent or model changes.
before deploying agent or model changes.
