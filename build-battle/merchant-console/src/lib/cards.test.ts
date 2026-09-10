import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_CURRENCIES,
  MAX_SPEND_LIMIT,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCard,
  spendRatio,
  validateCardInput,
} from "./cards"
import { CardStatus } from "@/data/types"

/**
 * A generated number that fails Luhn is a card that cannot be used, and a
 * number off the test BIN is a compliance problem rather than a bug. Both
 * are cheap to pin, so they are pinned.
 */

/** Deterministic PRNG so a failure is reproducible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("generateCardNumber", () => {
  it("issues 16 digits on the 4242 test BIN with a valid check digit", () => {
    const rand = seeded(20260813)
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber(rand)
      expect(number).toHaveLength(16)
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(/^\d{16}$/.test(number)).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("does not return the same number twice in a row", () => {
    const rand = seeded(1)
    expect(generateCardNumber(rand)).not.toBe(generateCardNumber(rand))
  })
})

describe("luhnCheckDigit / isValidLuhn", () => {
  it("agrees with a known-good test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("rejects a number with a single digit altered", () => {
    const number = generateCardNumber(seeded(7))
    const flipped =
      number.slice(0, 8) +
      String((Number(number[8]) + 1) % 10) +
      number.slice(9)
    expect(isValidLuhn(flipped)).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("maskCard", () => {
  it("is the only shape a number takes after creation", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  const all: CardStatus[] = ["active", "frozen", "cancelled"]

  it("moves between active and frozen in both directions", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live state", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    for (const to of all) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
  })

  it("refuses a transition to the status it already holds", () => {
    for (const status of all) {
      expect(canTransition(status, status)).toBe(false)
    }
  })
})

describe("validateCardInput", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
  }

  it("accepts a well-formed card", () => {
    const result = validateCardInput(valid)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.spendLimit).toBe(25000)
  })

  it("rejects a missing or unknown merchant", () => {
    expect(validateCardInput({ ...valid, merchantId: "" }).ok).toBe(false)
    expect(validateCardInput({ ...valid, merchantId: "mch_nope" }).ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(validateCardInput({ ...valid, spendLimit: 0 }).ok).toBe(false)
    expect(validateCardInput({ ...valid, spendLimit: -1 }).ok).toBe(false)
  })

  it("rejects a limit above the ceiling, and accepts the ceiling itself", () => {
    expect(validateCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 }).ok).toBe(false)
    expect(validateCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT }).ok).toBe(true)
  })

  it("rejects a non-integer limit, so no float reaches the store", () => {
    expect(validateCardInput({ ...valid, spendLimit: 250.5 }).ok).toBe(false)
    expect(validateCardInput({ ...valid, spendLimit: "25000" }).ok).toBe(false)
  })

  it("rejects a currency outside the allowlist", () => {
    expect(validateCardInput({ ...valid, currency: "JPY" }).ok).toBe(false)
    expect(validateCardInput({ ...valid, currency: "" }).ok).toBe(false)
  })

  it("accepts each allowed currency, on a merchant that settles in it", () => {
    // mch_01 USD, mch_04 GBP, mch_05 EUR.
    const byCurrency: Record<string, string> = {
      USD: "mch_01",
      GBP: "mch_04",
      EUR: "mch_05",
    }
    for (const currency of CARD_CURRENCIES) {
      const result = validateCardInput({
        ...valid,
        merchantId: byCurrency[currency],
        currency,
      })
      expect(result.ok).toBe(true)
    }
  })

  it("refuses a currency the merchant does not settle in", () => {
    // The dialog picks the currency for you; a direct API call must still agree.
    const result = validateCardInput({ ...valid, merchantId: "mch_01", currency: "EUR" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain("USD")
  })

  it("rejects a missing nickname", () => {
    expect(validateCardInput({ ...valid, nickname: "   " }).ok).toBe(false)
  })

  it("rejects a non-object payload", () => {
    expect(validateCardInput(null).ok).toBe(false)
    expect(validateCardInput("card").ok).toBe(false)
  })
})

describe("spendRatio", () => {
  it("reports spend against the limit, clamped", () => {
    expect(spendRatio({ spend: 0, spendLimit: 25000 })).toBe(0)
    expect(spendRatio({ spend: 20000, spendLimit: 25000 })).toBe(0.8)
    expect(spendRatio({ spend: 99999, spendLimit: 25000 })).toBe(1)
    expect(spendRatio({ spend: 100, spendLimit: 0 })).toBe(0)
  })
})
