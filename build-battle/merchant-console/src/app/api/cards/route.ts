import { listCards } from "@/data/queries"
import { store } from "@/data/store"
import { Card } from "@/data/types"
import { generateCardNumber, validateCardInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Next id, derived from the highest already issued rather than the count, so
 * removing a card can never hand a new one an id that already existed.
 */
function nextCardId(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.replace("card_", ""))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `card_${String(highest + 1).padStart(4, "0")}`
}

/** Issued cards. Masked: no route but creation ever returns a full number. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issue a card.
 *
 * The number is generated here, server-side, and returned exactly once in
 * this response. It is never written to the Card record, so there is nothing
 * to re-read afterwards.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  const parsed = validateCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const number = generateCardNumber()
  const card: Card = {
    id: nextCardId(),
    nickname: parsed.value.nickname,
    merchantId: parsed.value.merchantId,
    spendLimit: parsed.value.spendLimit,
    spend: 0,
    currency: parsed.value.currency,
    last4: number.slice(-4),
    reference: `ref_${number.slice(-4)}_${Date.now().toString(36)}`,
    status: "active",
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)

  // `number` appears here and nowhere else, ever.
  return NextResponse.json({ card, number }, { status: 201 })
}
