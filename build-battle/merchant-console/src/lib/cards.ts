import { merchantById } from "@/data/merchants"
import { Card, CardStatus, Currency } from "@/data/types"

/**
 * Virtual card issuing (NWP-201).
 *
 * Numbers are generated here, on the server, on the 4242 test BIN with a
 * valid Luhn check digit, so nothing in this repository can resemble a real
 * PAN. The full number is returned once by the creation route and is never
 * written to the Card record — see the Card type.
 */

/** Test BIN. Every generated number starts with it. Not optional. */
export const CARD_BIN = "4242"

const CARD_LENGTH = 16

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** Integer minor units. A limit above this is refused at the boundary. */
export const MAX_SPEND_LIMIT = 5_000_000

/**
 * Luhn check digit for a 15-digit body. Appending it yields a 16-digit
 * number that satisfies isValidLuhn.
 */
export function luhnCheckDigit(body: string): number {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    let digit = Number(body[body.length - 1 - i])
    // Once the check digit is appended, these are the doubled positions.
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

export function isValidLuhn(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false
  let sum = 0
  for (let i = 0; i < cardNumber.length; i++) {
    let digit = Number(cardNumber[cardNumber.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/**
 * A 16-digit number on the test BIN. `rand` is injectable so tests can pin
 * the output; production callers use Math.random.
 */
export function generateCardNumber(rand: () => number = Math.random): string {
  let body = CARD_BIN
  while (body.length < CARD_LENGTH - 1) {
    body += String(Math.floor(rand() * 10))
  }
  return body + String(luhnCheckDigit(body))
}

/** The only way a card number is rendered after creation. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/**
 * Status is a state machine: active reversibly to frozen, either to
 * cancelled, and cancelled is terminal. Guarded on the server, not only in
 * the UI.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export interface CardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
}

export type CardValidation =
  | { ok: true; value: CardInput }
  | { ok: false; message: string }

/**
 * Everything here arrives from the client and is checked against an
 * allowlist before it reaches the store. Rejects early and returns.
 */
export function validateCardInput(raw: unknown): CardValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "Expected a card to issue." }
  }
  const input = raw as Record<string, unknown>

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Give the card a nickname." }
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId.trim() : ""
  if (!merchantId || !merchantById(merchantId)) {
    return { ok: false, message: "Choose a merchant for this card." }
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return { ok: false, message: "Spend limit must be a whole number of minor units." }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      message: `Spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`,
    }
  }

  const currency = input.currency
  if (
    typeof currency !== "string" ||
    !CARD_CURRENCIES.includes(currency as Currency)
  ) {
    return {
      ok: false,
      message: `Currency must be one of: ${CARD_CURRENCIES.join(", ")}.`,
    }
  }

  return {
    ok: true,
    value: { nickname, merchantId, spendLimit, currency: currency as Currency },
  }
}

/** Fraction of the limit spent, clamped to [0, 1]. */
export function spendRatio(card: Pick<Card, "spend" | "spendLimit">): number {
  if (card.spendLimit <= 0) return 0
  return Math.min(1, Math.max(0, card.spend / card.spendLimit))
}
