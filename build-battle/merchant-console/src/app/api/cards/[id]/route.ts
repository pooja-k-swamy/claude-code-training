import { cardById } from "@/data/queries"
import { CardStatus } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/** One card, masked. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const card = cardById((await params).id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * Move a card through its state machine: active reversibly to frozen, either
 * to cancelled, cancelled terminal. Guarded here rather than only in the UI.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const card = cardById((await params).id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  const status = (body as { status?: unknown })?.status
  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: `Status must be one of: ${STATUSES.join(", ")}.` },
      { status: 400 },
    )
  }

  if (!canTransition(card.status, status as CardStatus)) {
    return NextResponse.json(
      { message: `A ${card.status} card cannot become ${status}.` },
      { status: 409 },
    )
  }

  card.events.push({
    at: new Date().toISOString(),
    from: card.status,
    to: status as CardStatus,
  })
  card.status = status as CardStatus
  return NextResponse.json({ card })
}
