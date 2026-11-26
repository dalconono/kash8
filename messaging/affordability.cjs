function parseMoney(value, digits) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:\.(\d{1,4}))?$/.exec(value)
  if (!match || (match[2]?.length ?? 0) > digits) throw new Error('Invalid amount')
  return Number(match[1]) * 10 ** digits + Number((match[2] ?? '').padEnd(digits, '0'))
}

function createProfile(json) {
  const data = JSON.parse(json)
  if (!Intl.supportedValuesOf('currency').includes(data.currency)) throw new Error('Invalid profile currency')
  const formatter = new Intl.NumberFormat('en', {
    style: 'currency', currency: data.currency, currencyDisplay: 'code',
  })
  const digits = formatter.resolvedOptions().maximumFractionDigits
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.asOf)) throw new Error('Missing profile date')
  if (!Number.isFinite(Date.parse(data.asOf)) || data.asOf > new Date().toISOString().slice(0, 10)) throw new Error('Invalid profile date')
  const amounts = Object.fromEntries(['cash', 'buffer', 'monthlySpare'].map((key) => [key, parseMoney(data[key], digits)]))
  return { data, digits, amounts, money: (minor) => formatter.format(minor / 10 ** digits) }
}

function checkCost(args, profile) {
  const { data, digits, amounts, money } = profile
  if (args.currency !== data.currency) {
    return `Your saved budget is in ${data.currency}. What does the offer cost in ${data.currency}, including any exchange fees?`
  }
  const upfront = parseMoney(args.upfront, digits)
  const monthly = parseMoney(args.monthly, digits)
  const afterBuffer = amounts.cash - upfront - amounts.buffer
  const monthlyLeft = amounts.monthlySpare - monthly
  const cashLine = afterBuffer >= 0
    ? `You’d have ${money(afterBuffer)} in cash above the amount you want to keep aside.`
    : `You’d be ${money(-afterBuffer)} below the amount you want to keep aside.`
  const monthlyLine = monthlyLeft >= 0
    ? `Your monthly budget would have ${money(monthlyLeft)} left.`
    : `Your monthly budget would be ${money(-monthlyLeft)} short.`
  return `${cashLine} ${monthlyLine}\n\nChecked ${money(upfront)} upfront and ${money(monthly)} a month against your manually entered figures from ${data.asOf}.`
}

module.exports = { createProfile, checkCost }
