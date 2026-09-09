import { Card } from "./types"

/**
 * A handful of cards so /cards is not empty on a fresh boot and the spend
 * bar has something to show. Fixed values rather than generated ones: this
 * is fixture data, and a reviewer should be able to read the numbers.
 *
 * Last four only — a seeded card has no full number either, because no card
 * record anywhere in this codebase carries one.
 */
export function seedCards(): Card[] {
  return [
    {
      id: "card_0001",
      nickname: "Google Ads",
      merchantId: "mch_01",
      spendLimit: 250000,
      spend: 218400,
      currency: "USD",
      last4: "4318",
      reference: "ref_seed_0001",
      status: "active",
      createdAt: "2026-07-28T09:12:00.000Z",
    },
    {
      id: "card_0002",
      nickname: "Figma team seats",
      merchantId: "mch_04",
      spendLimit: 60000,
      spend: 14400,
      currency: "GBP",
      last4: "9071",
      reference: "ref_seed_0002",
      status: "active",
      createdAt: "2026-08-02T14:40:00.000Z",
    },
    {
      id: "card_0003",
      nickname: "Contractor tooling",
      merchantId: "mch_05",
      spendLimit: 120000,
      spend: 0,
      currency: "EUR",
      last4: "5533",
      reference: "ref_seed_0003",
      status: "frozen",
      createdAt: "2026-08-06T08:05:00.000Z",
    },
    {
      id: "card_0004",
      nickname: "Trade show travel",
      merchantId: "mch_02",
      spendLimit: 90000,
      spend: 90000,
      currency: "USD",
      last4: "1180",
      reference: "ref_seed_0004",
      status: "cancelled",
      createdAt: "2026-08-09T17:20:00.000Z",
    },
  ]
}
