// Set this Function to Protected in Twilio.
const replies = {
  "LEASE": "Sample data • Once you include running costs, the car leaves you £64 short each month. The upfront payment also takes you £300 below your cash buffer. With the same running costs, a lease payment of £225 is the most your monthly plan covers. An upfront payment of £2,100 would leave your cash buffer intact.",
  "DINNER": "Sample data • You usually spend around £240 a month on dining. It’s near month-end and you’ve already spent £243 in that category, with £87 left in your plan. Both original dinners would put you £14 over. Little Olive also serves pasta. In this example it keeps both nights within your dining budget.",
  "REVIEW": "Sample data • You had £390 left after spending last month. Spending was £120 above your six-month average. Housing and bills were your biggest category. Food and dining were £70 above their previous five-month average. Try a £350 food and dining target next month. Matching it would free £40 at last month’s spending level."
}

const currencies = new Set(Intl.supportedValuesOf('currency'))

function currencyFor(text, sample) {
  const codes = new Set([...text.matchAll(/\bcurrency\s+([a-z]{3})\b/gi)].map((match) => match[1].toUpperCase()))
  for (const [code] of text.matchAll(/\b[A-Z]{3}\b/g)) {
    if (currencies.has(code)) codes.add(code)
  }
  if (text.includes('£')) codes.add('GBP')
  if (text.includes('€')) codes.add('EUR')
  if (codes.size > 1) return { error: 'Use one currency for all figures in this check.' }
  const code = [...codes][0] ?? (sample ? 'GBP' : null)
  if (!code || !currencies.has(code)) return { error: 'Add a currency code, for example “currency CHF” or “currency USD”.' }
  if (/[$¥₹]/.test(text)) return { error: 'Use a currency code and enter the amounts without currency symbols.' }
  if (sample && code !== 'GBP') return { error: 'The example uses GBP. For another currency, enter your own amounts.' }
  const format = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'code' })
  return { digits: format.resolvedOptions().maximumFractionDigits, money: (minor) => format.format(minor / 10000) }
}
const amountPattern = String.raw`(?:[£€]\s*)?(\d{1,8}(?:\.\d{1,4})?)(?![\d.]|,\d)`
const leaseFields = [
  ['monthly', 'monthly payment', 'monthly'],
  ['upfront', 'upfront payment', 'upfront'],
  ['running', 'monthly running costs', 'running'],
  ['spare', 'money left each month after bills and savings', 'spare'],
  ['cash', 'cash available now', 'cash'],
  ['buffer', 'cash you want to keep aside', 'buffer'],
]

function findAmount(text, label, digits) {
  const match = text.match(new RegExp(String.raw`\b${label}\s*[:=]?\s*${amountPattern}`, 'i'))
  if (!match) return null
  const [whole, decimals = ''] = match[1].split('.')
  if (decimals.length > digits) return null
  return Number(whole) * 10000 + Number(decimals.padEnd(4, '0'))
}

function leaseReply({ monthly, upfront, running, spare, cash, buffer }, source, money) {
  const monthlyCost = monthly + running
  const monthlyLeft = spare - monthlyCost
  const cashLeft = cash - upfront
  const reserveLeft = cashLeft - buffer
  const monthlyVerdict = monthlyLeft < 0
    ? `You’d be ${money(-monthlyLeft)} short each month.`
    : `You’d have ${money(monthlyLeft)} left each month.`
  const reserveVerdict = reserveLeft < 0
    ? `That’s ${money(-reserveLeft)} below what you want to keep aside.`
    : `That’s ${money(reserveLeft)} above what you want to keep aside.`
  return `${source} • ${monthlyVerdict} The payment and running costs total ${money(monthlyCost)} a month. The upfront payment leaves ${money(cashLeft)} in cash. ${reserveVerdict}`
}

function replyTo(body) {
  const text = body.trim()
  const command = text.toUpperCase()
  if (Object.hasOwn(replies, command)) return replies[command]
  const sample = /^(?:sample|demo)\s+lease\b/i.test(text)
  const labels = leaseFields.map(([, label, key]) => `${key} (${label})`).join(', ')
  if (/\b(?:cash buffer|cash reserve)\b/i.test(text) && !/^(?:(?:sample|demo)\s+)?lease\b/i.test(text)) {
    if (!/\d/.test(text)) return 'A cash buffer is money you plan to keep for surprises.'
    const { error, digits, money } = currencyFor(text, false)
    if (error) return error
    const cash = findAmount(text, 'cash', digits)
    const upfront = findAmount(text, 'upfront', digits)
    const buffer = findAmount(text, 'buffer', digits)
    if (cash !== null && upfront !== null && buffer !== null) {
      const left = cash - upfront
      const difference = left - buffer
      const comparison = difference === 0 ? 'exactly your target' : `${money(Math.abs(difference))} ${difference < 0 ? 'below' : 'above'} your target`
      return `Your figures • A cash buffer is money you plan to keep for surprises. Paying ${money(upfront)} from ${money(cash)} leaves ${money(left)}, which is ${comparison}.`
    }
    return 'A cash buffer is money you plan to keep for surprises. To see what yours would look like after a purchase, send “cash buffer” with cash, upfront and buffer amounts.'
  }
  if (/\blease\b/i.test(text)) {
    const { error, digits, money } = currencyFor(text, sample)
    if (error) return error
    const values = Object.fromEntries(leaseFields.map(([key]) => [key, findAmount(text, key, digits)]))
    if (sample) {
      const demo = { monthly: 2890000, upfront: 24000000, running: 1950000, spare: 4200000, cash: 41000000, buffer: 20000000 }
      for (const [key] of leaseFields) if (values[key] !== null) demo[key] = values[key]
      return leaseReply(demo, 'Sample data', money)
    }
    const missing = leaseFields.filter(([key]) => values[key] === null)
    if (missing.length) {
      return `I need ${missing.map(([, label, key]) => `${label} (${key})`).join(', ')}. Send everything together so I can check it. Use decimal points and no thousands separators. Format: lease currency EUR, monthly 200, upfront 2400, running 195, spare 420, cash 4100, buffer 2000.`
    }
    return leaseReply(values, 'Your figures', money)
  }
  return `This pilot checks how a lease fits your budget. Send LEASE for the example, “sample lease monthly 200” to change it, or “lease” with your own amounts. Use these labels: ${labels}. DINNER and REVIEW show sample checks.`
}

exports.handler = (context, event, callback) => {
  const response = new Twilio.twiml.MessagingResponse()
  const testers = (context.KASH8_TESTERS || '').split(',').map(value => value.trim())
  const sender = String(event.From || '').replace(/^whatsapp:/, '')
  if (sender && testers.includes(sender)) {
    response.message(replyTo(String(event.Body || '')))
  }
  return callback(null, response)
}
