"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel without a full page reload. The server owns
 * the state machine; this only offers the transitions it will accept.
 */
export function CardStatusControls({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">Cancelled cards cannot be reopened.</p>
    )
  }

  const move = async (next: CardStatus) => {
    setPending(next)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.message ?? "Could not update this card.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            className="py-1.5"
            disabled={pending !== null}
            onClick={() => move("frozen")}
          >
            {pending === "frozen" ? "Freezing…" : "Freeze"}
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="py-1.5"
            disabled={pending !== null}
            onClick={() => move("active")}
          >
            {pending === "active" ? "Unfreezing…" : "Unfreeze"}
          </Button>
        )}
        <Button
          variant="destructive"
          className="py-1.5"
          disabled={pending !== null}
          onClick={() => move("cancelled")}
        >
          {pending === "cancelled" ? "Cancelling…" : "Cancel card"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
