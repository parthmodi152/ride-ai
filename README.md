# RideAI — Agentic Ride Booking

An AI agent that books rides end-to-end: discover options, compare prices, book with human confirmation, track, and cancel. Built with Next.js 16, AI SDK v6, and a swappable platform adapter.

## Architecture

```
┌─────────────┐     ┌────────────┐     ┌──────────────────┐
│  Agent Loop  │────▶│ Tool Layer │────▶│ Platform Adapter │
│  (streamText │     │ (4 tools,  │     │ (PlatformAdapter │
│   + prompt)  │     │  Zod schemas│    │  interface)      │
└─────────────┘     └────────────┘     └──────────────────┘
       │                   │
       │            ┌──────┴───────┐
       │            │  HITL Gates  │
       │            │ (bookRide,   │
       │            │  cancelRide) │
       │            └──────────────┘
       │
 ┌─────┴──────┐
 │ Action Log │──▶ Redis (Upstash) or in-memory
 │ Telemetry  │
 └────────────┘
```

**Agent loop** — `app/api/chat/route.ts`. A `streamText` call with a system prompt, tool set, and step limit. The LLM decides which tools to call. It has no knowledge of which platform backs the tools.

**Tool layer** — `lib/tools/ride-tools.ts`. Four tools (`searchRides`, `bookRide`, `cancelRide`, `trackRide`) created via `createRideTools(adapter)`. Each delegates to the adapter interface. `bookRide` and `cancelRide` have no `execute` function — they're HITL gates. The AI SDK emits the tool call as a proposal, the client renders confirm/decline, and only a user-initiated POST executes the action.

**Platform adapter** — `lib/adapters/types.ts`. A `PlatformAdapter` interface with four methods and normalized response types. Swapping platforms = one new adapter file + one line in the registry.

**Action log** — `lib/action-log/integration.ts`. Hooks into the AI SDK's `TelemetryIntegration` to capture every tool start, finish, error, HITL request, and HITL outcome.

## Quick Start

```bash
git clone <repo-url> && cd ride-ai
cp .env.example .env       # add your OpenAI key
npm install
npm run dev                 # http://localhost:3000
```

Only `OPENAI_API_KEY` is required. Geocoding falls back to hardcoded NYC landmarks without a Google Places key. The action log uses in-memory storage without Redis.

## Transcripts

Five conversation transcripts covering the core flows:

| Transcript | Scenario |
|---|---|
| [Happy Path](docs/transcript-happyPath.md) | Search, compare, book, track |
| [Price Comparison](docs/transcript-priceComparison.md) | Evaluating multiple ride options |
| [Bad Address](docs/transcript-badAddress.md) | Unresolvable pickup/destination |
| [Edge Case](docs/transcript-edgeCase.md) | Surge pricing, fare expiry |
| [Cancellation](docs/transcript-cancellation.md) | Booking then cancelling a ride |

## Writeup

[Architecture & Portability](docs/writeup.md) — how the three-layer design enables platform swapping and what breaks first in production.

## Tech Stack

- **Next.js 16** — App Router, Server Components
- **AI SDK v6** — `streamText`, `useChat`, `TelemetryIntegration`, HITL via execute-less tools
- **OpenAI GPT-4o-mini** — agent reasoning
- **Upstash Redis** — persistent action log & telemetry (optional)
- **shadcn/ui** — component library
- **Tailwind CSS v4** — styling
