"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { Currency } from "@/data/types"
import { CARD_CURRENCIES, MAX_SPEND_LIMIT } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Issued = { last4: string; number: string; nickname: string }

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  /** Present only between a successful issue and closing the drawer. */
  const [issued, setIssued] = useState<Issued | null>(null)
  /** One key per dialog session, so a retried submit is not a second card. */
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setError(null)
    setIssued(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const close = () => {
    setOpen(false)
    // Drop the revealed number from client state the moment the drawer shuts.
    reset()
    router.refresh()
  }

  const submit = async () => {
    // Already issuing, or already issued: a second click must not issue again.
    if (pending || issued) return
    setError(null)
    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter a limit like 250 or 250.00.")
      return
    }

    setPending(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ nickname, merchantId, spendLimit, currency }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? "Could not issue the card.")
        return
      }
      setIssued({
        last4: data.card.last4,
        number: data.number,
        nickname: data.card.nickname,
      })
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>{issued ? "Card issued" : "Issue a virtual card"}</DrawerTitle>
          <DrawerDescription>
            {issued
              ? "Copy the number now. This is the only time it is shown."
              : "The number is generated when you submit."}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-5">
          {issued ? (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {issued.nickname}
                </p>
                <p className="mt-2 font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Everywhere else in the console this card is{" "}
                <span className="font-medium text-gray-900 dark:text-gray-50">
                  •••• {issued.last4}
                </span>
                . The full number is not stored and cannot be shown again.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend"
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(id) => {
                    setMerchantId(id)
                    const m = merchants.find((x) => x.id === id)
                    if (m) setCurrency(m.currency)
                  }}
                >
                  <SelectTrigger id="card-merchant" className="mt-2 w-full py-1.5">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="250.00"
                    className="mt-2"
                  />
                </div>
                <div className="w-28">
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(c) => setCurrency(c as Currency)}
                  >
                    <SelectTrigger id="card-currency" className="mt-2 w-full py-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Maximum {formatMoney(MAX_SPEND_LIMIT, currency)}.
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </>
          )}
        </DrawerBody>

        <DrawerFooter>
          {issued ? (
            <Button className="py-1.5" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" className="py-1.5" onClick={close}>
                Cancel
              </Button>
              <Button className="py-1.5" onClick={submit} disabled={pending}>
                {pending ? "Issuing…" : "Issue card"}
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
