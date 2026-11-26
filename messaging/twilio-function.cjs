// Set this Function to Protected in Twilio.
const replies = {
  "LEASE": "Sample data • Once you include running costs, the car leaves you £64 short each month. The upfront payment also takes you £300 below your cash buffer. With the same running costs, a lease payment of £225 is the most your monthly plan covers. An upfront payment of £2,100 would leave your cash buffer intact.",
  "DINNER": "Sample data • You usually spend around £240 a month on dining. It’s near month-end and you’ve already spent £243 in that category, with £87 left in your plan. Both original dinners would put you £14 over. Little Olive also serves pasta. In this example it keeps both nights within your dining budget.",
  "REVIEW": "Sample data • You had £390 left after spending last month. Spending was £120 above your six-month average. Housing and bills were your biggest category. Food and dining were £70 above their previous five-month average. Try a £350 food and dining target next month. Matching it would free £40 at last month’s spending level."
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 })
const amountPattern = String.raw`(?:£\s*)?(\d{1,8}(?:\.\d{1,2})?)(?![\d.]|,\d)`
const leaseFields = [
  ['monthly', 'monthly payment', 'monthly'],
  ['upfront', 'upfront payment', 'upfront'],
  ['running', 'monthly running costs', 'running'],
  ['spare', 'money left each month after bills and savings', 'spare'],
  ['cash', 'cash available now', 'cash'],
  ['buffer', 'cash you want to keep aside', 'buffer'],
]

function findAmount(text, label) {
  const match = text.match(new RegExp(String.raw`\b${label}\s*[:=]?\s*${amountPattern}`, 'i'))
  if (!match) return null
  const [whole, decimals = ''] = match[1].split('.')
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
}

function money(pence) {
  return gbp.format(pence / 100)
}

function leaseReply({ monthly, upfront, running, spare, cash, buffer }, source) {
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
    const cash = findAmount(text, 'cash')
    const upfront = findAmount(text, 'upfront')
    const buffer = findAmount(text, 'buffer')
    if (cash !== null && upfront !== null && buffer !== null) {
      const left = cash - upfront
      const difference = left - buffer
      const comparison = difference === 0 ? 'exactly your target' : `${money(Math.abs(difference))} ${difference < 0 ? 'below' : 'above'} your target`
      return `Your figures • A cash buffer is money you plan to keep for surprises. Paying ${money(upfront)} from ${money(cash)} leaves ${money(left)}, which is ${comparison}.`
    }
    return 'A cash buffer is money you plan to keep for surprises. To see what yours would look like after a purchase, send “cash buffer” with cash, upfront and buffer amounts.'
  }
  if (/\blease\b/i.test(text)) {
    if (/[€$]|\b(?:EUR|USD|CHF)\b/i.test(text)) return 'This pilot checks leases in GBP. Send all amounts in pounds to run the comparison.'
    const values = Object.fromEntries(leaseFields.map(([key]) => [key, findAmount(text, key)]))
    if (sample) {
      const demo = { monthly: 28900, upfront: 240000, running: 19500, spare: 42000, cash: 410000, buffer: 200000 }
      for (const [key] of leaseFields) if (values[key] !== null) demo[key] = values[key]
      return leaseReply(demo, 'Sample data')
    }
    const missing = leaseFields.filter(([key]) => values[key] === null)
    if (missing.length) {
      return `I need ${missing.map(([, label, key]) => `${label} (${key})`).join(', ')}. Send everything together so I can check it. Format: lease monthly 200, upfront 2400, running 195, spare 420, cash 4100, buffer 2000.`
    }
    return leaseReply(values, 'Your figures')
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
