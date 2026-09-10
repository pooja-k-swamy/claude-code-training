import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById } from "@/data/queries"
import { maskCard, spendRatio } from "@/lib/cards"
import { formatDate, formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusControls } from "./status-controls"

const LABELS: Record<string, string> = {
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const card = cardById((await params).id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const ratio = spendRatio(card)
  const percent = Math.round(ratio * 100)
  const remaining = Math.max(0, card.spendLimit - card.spend)
  // Amber past 80% of the limit, red once it is exhausted.
  const barColor =
    ratio >= 1
      ? "bg-red-500 dark:bg-red-500"
      : ratio > 0.8
        ? "bg-amber-500 dark:bg-amber-500"
        : "bg-blue-500 dark:bg-blue-500"

  return (
    <section aria-label={`Card ${card.nickname}`} className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="mt-1 font-mono text-gray-500 tabular-nums">
            {maskCard(card.last4)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={card.status} />
          <CardStatusControls id={card.id} status={card.status} />
        </div>
      </div>

      <Divider />

      <div className="max-w-xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Spend against limit
          </h2>
          <p className="text-sm tabular-nums text-gray-500">{percent}%</p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent} percent of the spend limit used`}
        >
          <div
            className={cx("h-full rounded-full transition-all", barColor)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500 tabular-nums">
          {formatMoney(card.spend, card.currency)} of{" "}
          {formatMoney(card.spendLimit, card.currency)} ·{" "}
          {formatMoney(remaining, card.currency)} remaining
        </p>
      </div>

      <Divider />

      <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {[
          ["Card ID", card.id],
          ["Merchant", merchant?.name ?? card.merchantId],
          ["Card number", maskCard(card.last4)],
          ["Spend limit", formatMoney(card.spendLimit, card.currency)],
          ["Currency", card.currency],
          ["Reference", card.reference],
          ["Issued", formatDate(card.createdAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-gray-500">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900 tabular-nums dark:text-gray-50">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <Divider />

      <div className="max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          History
        </h2>
        <ol className="mt-3 space-y-2">
          {[...card.events].reverse().map((event, i) => (
            <li
              key={`${event.at}-${i}`}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <span className="text-gray-900 dark:text-gray-50">
                {event.from === null
                  ? "Issued"
                  : `${LABELS[event.from]} \u2192 ${LABELS[event.to]}`}
              </span>
              <span className="tabular-nums text-gray-500">
                {formatInZone(event.at, merchant?.timezone ?? "UTC")}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-8 max-w-xl text-xs text-gray-500">
        The full number was shown once, when this card was issued. It is not
        stored and cannot be shown again.
      </p>
    </section>
  )
}
