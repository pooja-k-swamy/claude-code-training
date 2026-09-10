import { Card, CardEvent, CardStatus, Currency, Payment } from "./types"

/**
 * A handful of cards so /cards is not empty on a fresh boot.
 *
 * Spend is NOT invented. Each card's spend is derived from real captured
 * payments in the store — the merchant's own payments, in the card's
 * currency, dated after the card was issued — capped at the limit, because a
 * card cannot spend past its own ceiling. Change the seed payments and these
 * numbers move with them.
 *
 * Cards issued through the console start at zero and stay there: nothing in
 * this app records a charge against a card, and wiring that up is not in
 * NWP-201.
 */

interface SeedCard {
  id: string
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  last4: string
  status: CardStatus
  createdAt: string
}

const SEED: SeedCard[] = [
  {
    id: "card_0001",
    nickname: "Google Ads",
    merchantId: "mch_01",
    // Limit set just above the card's derived spend, so the demo exercises the
    // amber band. The spend itself is still derived, not chosen.
    spendLimit: 200000,
    currency: "USD",
    last4: "4318",
    status: "active",
    createdAt: "2026-08-11T09:12:00.000Z",
  },
  {
    id: "card_0002",
    nickname: "Figma team seats",
    merchantId: "mch_04",
    spendLimit: 600000,
    currency: "GBP",
    last4: "9071",
    status: "active",
    createdAt: "2026-08-10T14:40:00.000Z",
  },
  {
    id: "card_0003",
    nickname: "Contractor tooling",
    merchantId: "mch_05",
    spendLimit: 120000,
    currency: "EUR",
    last4: "5533",
    status: "frozen",
    createdAt: "2026-08-12T08:05:00.000Z",
  },
  {
    id: "card_0004",
    nickname: "Trade show travel",
    merchantId: "mch_02",
    spendLimit: 90000,
    currency: "USD",
    last4: "1180",
    status: "cancelled",
    createdAt: "2026-08-09T17:20:00.000Z",
  },
]

/**
 * Captured payments for this merchant, in this currency, since the card was
 * issued. Integer minor units throughout; capped at the card's limit.
 */
export function deriveSpend(card: SeedCard, payments: Payment[]): number {
  const spent = payments
    .filter(
      (payment) =>
        payment.merchantId === card.merchantId &&
        payment.currency === card.currency &&
        payment.status === "captured" &&
        payment.createdAt >= card.createdAt,
    )
    .reduce((total, payment) => total + payment.amount, 0)
  return Math.min(spent, card.spendLimit)
}

/** Issue, plus the one transition that put a non-active card where it is. */
function buildEvents(card: SeedCard): CardEvent[] {
  const events: CardEvent[] = [{ at: card.createdAt, from: null, to: "active" }]
  if (card.status !== "active") {
    events.push({ at: card.createdAt, from: "active", to: card.status })
  }
  return events
}

export function seedCards(payments: Payment[]): Card[] {
  return SEED.map((card) => ({
    ...card,
    spend: deriveSpend(card, payments),
    reference: `ref_seed_${card.last4}`,
    events: buildEvents(card),
  }))
}
