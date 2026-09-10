# Spec · NWP-201 · Issue virtual cards from the console

Written before the build and followed as ordered below. Recorded here after the
fact from the plan the work actually followed — the ordering, the file list and
the two flagged judgement calls are as they were agreed, not reconstructed to
match the diff.

## What exists today

Nothing card-shaped. `CLAUDE.md` says so directly: *"Cards is NWP-201 and does
not exist yet."* Three facts worth knowing before touching anything:

- `src/data/store.ts:16-22` — `Store` has no `cards` field. Adding one is two
  lines, but the store is cached on `globalThis:34`, so the dev server must be
  restarted before the field appears.
- `src/app/siteConfig.ts:5-10` and `AppSidebar.tsx:25-49` — nav is data-driven.
  `/cards` needs an entry in each or the page exists and nobody can reach it.
- `.claude/rules/cards.md` auto-loads on `src/**/card*.ts`, so naming the lib
  `cards.ts` pulls the card rules into context.

## Order of work

Server first, then UI. A form built against an unvalidated route is a form that
gets rewritten.

1. **`src/data/types.ts`** — `Card`, `CardStatus`, `CardEvent`. The load-bearing
   detail is the field that is *absent*: no `number`. The PAN exists in the
   creation response and nowhere else.
2. **`src/lib/cards.ts`** — pure, no I/O, all testable: `luhnCheckDigit`,
   `generateCardNumber` (injectable `rand`), `isValidLuhn`, `maskCard`,
   `canTransition`, `validateCardInput`, `spendRatio`.
3. **`src/lib/cards.test.ts`** — written with the lib, not at the end.
4. **`src/data/cards-seed.ts` + `store.ts`** — seed cards so `/cards` is not
   empty and the spend bar has something to show.
5. **Routes** — `POST/GET /api/cards`, `GET/PATCH /api/cards/[id]`.
6. **Checkpoint** — curl every validation and transition case before any UI.
7. **UI** — `/cards` list, issue dialog on `Drawer`, `/cards/[id]` detail.

## Design decisions

**No full number on the record.** `Card` keeps `last4` and an opaque
`reference`. The reveal is a one-time response, so there is nothing to re-read.

**Validation in the lib, called by the route.** Same tagged-result shape as
`parseExportColumns` in `csv.ts`: `{ok:true, value} | {ok:false, message}`.
Rejections never echo client input back.

**Currency follows the merchant.** A card is single-merchant, so it settles in
that merchant's currency. The dialog sets it; the server enforces it.

**One query builder.** `listCards`/`cardById` go in `queries.ts` rather than
being hand-rolled in the route.

**Idempotent issue.** An `Idempotency-Key` header maps to the card it created,
so a double-click or a retry returns the original and does not mint a second
number.

## Two judgement calls, flagged at planning time

**Seed cards vs. an empty list.** Seeding demonstrates the spend bar; an empty
list demonstrates the empty state. Chose to seed *and* write the empty state,
since the latter is still code a reviewer reads. Spend is **derived** from real
captured payments for that merchant, in that currency, after the card's issue
date, capped at the limit — not invented. Cards issued through the console
start at zero and stay there, because nothing in this app records a charge
against a card.

**Pre-push hook build step.** The hook runs `npm test` and `npm run build`; the
build is 60–90s. Made it conditional on `PREPUSH_FULL=1` so pushing often stays
cheap, with the full gate available for the push that matters.

## How we know it worked

- `npm test` — unit tests on the generator (1000 seeded iterations), the full
  transition matrix, and every validation rule.
- `curl` — every validation rejection and every legal and illegal transition.
- Browser — issue a card end to end, confirm the number appears once and is
  gone afterwards, confirm no 16-digit string on `/cards`, confirm the bar
  colour at each threshold, confirm freeze/unfreeze fires zero navigations.
- `npx tsc --noEmit` and `next lint`, since vitest is node-only and never
  touches the `.tsx` files.

## Out of scope

Persistence (NWP-203), auth, real card network calls, editing a limit after
issue (NWP-202).
