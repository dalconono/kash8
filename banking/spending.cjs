// Input dates are booking dates in the user's reporting timezone.
// Normalize provider records to integer minor units before calling this module.
function calendarDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Expected a calendar date')
  }
  const parsed = new Date(date + 'T00:00:00Z')
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Invalid calendar date')
  }
  return parsed
}

const iso = (date) => date.toISOString().slice(0, 10)

function reportingWindow(period, today) {
  const day = calendarDate(today)
  if (period === 'yesterday') {
    day.setUTCDate(day.getUTCDate() - 1)
    return { start: iso(day), endExclusive: today }
  }
  const months = { 'last-month': 1, 'last-six-months': 6 }
  if (!Object.hasOwn(months, period)) throw new Error('Unknown reporting period')
  day.setUTCDate(1)
  const endExclusive = iso(day)
  day.setUTCMonth(day.getUTCMonth() - months[period])
  return { start: iso(day), endExclusive }
}

function addExact(left, right) {
  const result = left + right
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeded supported range')
  return result
}

const groupFields = { category: 'category', merchant: 'merchant', account: 'accountId', day: 'date', month: 'date' }

function spendingSummary({ period, today, range, accounts, records, filters = {}, groupBy = 'category' }) {
  if (range && period !== undefined) throw new Error('Choose a range or a preset')
  const window = range ? { start: range.start, endExclusive: range.endExclusive } : reportingWindow(period, today)
  calendarDate(window.start)
  calendarDate(window.endExclusive)
  if (window.start >= window.endExclusive) throw new Error('Invalid reporting range')
  if (!Object.hasOwn(groupFields, groupBy)) throw new Error('Invalid grouping')
  const filterFields = ['category', 'merchant', 'accountId', 'currency']
  for (const [field, value] of Object.entries(filters)) {
    if (!filterFields.includes(field) || typeof value !== 'string' || !value.trim()) {
      throw new Error('Invalid spending filter')
    }
  }
  const coverage = new Map()
  for (const account of accounts) {
    if (!account.id || coverage.has(account.id)) throw new Error('Invalid account coverage')
    calendarDate(account.from)
    calendarDate(account.through)
    if (account.through < account.from) throw new Error('Invalid account coverage dates')
    coverage.set(account.id, account)
  }

  const totals = new Map()
  const seen = new Map()
  for (const item of records) {
    if (!coverage.has(item.accountId)) throw new Error('Unexpected account in spending records')
    calendarDate(item.date)
    if (item.date < window.start || item.date >= window.endExclusive || !item.booked) continue
    if (!item.id || !/^[A-Z]{3}$/.test(item.currency) ||
        !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0 ||
        !['purchase', 'refund', 'transfer', 'income'].includes(item.kind)) {
      throw new Error('Invalid booked transaction')
    }
    const key = JSON.stringify([item.accountId, item.id])
    const category = item.category?.trim() || 'Uncategorised'
    const merchant = item.merchant?.trim() || 'Unknown merchant'
    const version = JSON.stringify([item.date, item.currency, item.amountMinor, item.kind, category, merchant])
    if (seen.has(key)) {
      if (seen.get(key) !== version) throw new Error('Conflicting booked transaction')
      continue
    }
    seen.set(key, version)
    if (item.kind === 'transfer' || item.kind === 'income') continue
    const details = { category, merchant, accountId: item.accountId, date: item.date, currency: item.currency }
    if (Object.entries(filters).some(([field, value]) => {
      return field === 'accountId'
        ? details[field] !== value
        : details[field].toLowerCase() !== value.trim().toLowerCase()
    })) continue
    const groupValue = groupBy === 'month' ? item.date.slice(0, 7) : details[groupFields[groupBy]]

    if (!totals.has(item.currency)) totals.set(item.currency, { spent: 0, refunded: 0, categories: new Map() })
    const group = totals.get(item.currency)
    const sign = item.kind === 'refund' ? -1 : 1
    const field = item.kind === 'refund' ? 'refunded' : 'spent'
    group[field] = addExact(group[field], item.amountMinor)
    group.categories.set(groupValue, addExact(group.categories.get(groupValue) ?? 0, sign * item.amountMinor))
  }

  const lastDay = calendarDate(window.endExclusive)
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  const selectedAccounts = [...coverage.values()].filter(({ id }) => !filters.accountId || id === filters.accountId)
  return {
    ...window,
    ...(groupBy === 'category' ? {} : { groupBy }),
    accountsIncluded: selectedAccounts.length,
    complete: selectedAccounts.length > 0 && selectedAccounts.every(
      ({ from, through }) => from <= window.start && through >= iso(lastDay),
    ),
    currencies: [...totals].map(([currency, group]) => ({
      currency,
      spentMinor: group.spent,
      refundedMinor: group.refunded,
      netMinor: group.spent - group.refunded,
      [groupBy === 'category' ? 'categories' : 'breakdown']: [...group.categories]
        .sort((a, b) => b[1] - a[1])
        .map(([label, netMinor]) => ({ [groupBy === 'category' ? 'category' : 'label']: label, netMinor })),
    })),
  }
}

function compareSpending({ baseline, comparison, ...input }) {
  const previous = spendingSummary({ ...input, range: baseline })
  const current = spendingSummary({ ...input, range: comparison })
  const totals = new Map(previous.currencies.map(({ currency, netMinor }) => [currency, -netMinor]))
  for (const { currency, netMinor } of current.currencies) {
    totals.set(currency, addExact(totals.get(currency) ?? 0, netMinor))
  }
  return {
    previous,
    current,
    changes: previous.complete && current.complete
      ? [...totals].map(([currency, changeMinor]) => ({ currency, changeMinor }))
      : null,
  }
}

module.exports = { reportingWindow, spendingSummary, compareSpending }
