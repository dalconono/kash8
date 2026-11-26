// Set this Function to Protected in Twilio.
const replies = {
  "LEASE": "Sample data • Once you include running costs, the car leaves you £64 short each month. The upfront payment also takes you £300 below your cash buffer. With the same running costs, a lease payment of £225 is the most your monthly plan covers. An upfront payment of £2,100 would leave your cash buffer intact.",
  "DINNER": "Sample data • You usually spend around £240 a month on dining. It’s near month-end and you’ve already spent £243 in that category, with £87 left in your plan. Both original dinners would put you £14 over. Little Olive also serves pasta. In this example it keeps both nights within your dining budget.",
  "REVIEW": "Sample data • You had £390 left after spending last month. Spending was £120 above your six-month average. Housing and bills were your biggest category. Food and dining were £70 above their previous five-month average. Try a £350 food and dining target next month. Matching it would free £40 at last month’s spending level."
}

exports.handler = (context, event, callback) => {
  const response = new Twilio.twiml.MessagingResponse()
  const testers = (context.KASH8_TESTERS || '').split(',').map(value => value.trim())
  const sender = String(event.From || '').replace(/^whatsapp:/, '')
  if (sender && testers.includes(sender)) {
    const command = String(event.Body || '').trim().toUpperCase()
    response.message(Object.hasOwn(replies, command)
      ? replies[command]
      : 'Kash8 demo. Reply LEASE, DINNER or REVIEW to try a sample money check.')
  }
  return callback(null, response)
}
