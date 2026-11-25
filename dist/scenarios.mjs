const pounds = (amount) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(amount)

const lease = { payment: 289, upfront: 2400, months: 36, running: 195, headroom: 420, liquid: 4100, buffer: 2000 }
const carMonthly = lease.payment + lease.running
const carShortfall = carMonthly - lease.headroom
const afterDeposit = lease.liquid - lease.upfront
const contractTotal = lease.upfront + lease.months * lease.payment

const dining = { prior: [226, 241, 253], spent: 243, budget: 330, tonight: 52, tomorrow: 49, alternative: 28 }
const diningAverage = dining.prior.reduce((a, b) => a + b) / dining.prior.length
const diningLeft = dining.budget - dining.spent
const twoDinners = dining.tonight + dining.tomorrow
const cheaperPlan = dining.tonight + dining.alternative

const spending = [
  1490, 1500, 1550, 1590, 1570, 1540,
  1520, 1580, 1640, 1640, 1700, 1760,
]
const sum = (values) => values.reduce((a, b) => a + b, 0)
const sixMonths = sum(spending.slice(-6))
const fullYear = sum(spending)
const lastMonth = spending.at(-1)
const categories = [['Housing and bills', 980], ['Food and dining', 390], ['Transport', 175], ['Other', 215]]
const lastIncome = 2150
const priorDining = 320

export const scenarios = {
  lease: {
    question: 'Can I afford this car lease at £289 a month with £2,400 upfront?',
    steps: ['Read the sample lease quote', 'Checked recurring bills and savings', 'Estimated insurance, fuel and upkeep'],
    title: 'This lease would stretch your budget',
    answer: `Once you include running costs, the car leaves you ${pounds(carShortfall)} short each month. The upfront payment also takes you ${pounds(lease.buffer - afterDeposit)} below your cash buffer.`,
    rows: [
      ['Monthly room after bills and savings', pounds(lease.headroom)],
      ['Lease and estimated running costs', pounds(carMonthly)],
      ['Total paid under the lease', pounds(contractTotal)],
      ['Cash left after upfront payment', pounds(afterDeposit)],
    ],
    next: `With the same running costs, a lease payment of ${pounds(lease.headroom - lease.running)} is the most your monthly plan covers. An upfront payment of ${pounds(lease.liquid - lease.buffer)} would leave your cash buffer intact.`,
    assumptions: 'The fictional quote has a separate upfront payment and 36 monthly payments. Running costs are estimates. The contract total excludes running costs, excess mileage, damage charges and early exit fees.',
  },
  dinner: {
    question: 'Can I do pasta at Finch Lane tonight and Via Verde tomorrow?',
    steps: ['Compared the last three months of dining', 'Checked the remaining dining budget', 'Compared prices on sample Italian menus'],
    title: 'Finch Lane fits. Try a cheaper spot tomorrow.',
    answer: `You usually spend around ${pounds(diningAverage)} a month on dining. It’s near month-end and you’ve already spent ${pounds(dining.spent)} in that category, with ${pounds(diningLeft)} left in your plan. Both original dinners would put you ${pounds(twoDinners - diningLeft)} over.`,
    rows: [
      ['Finch Lane tonight', pounds(dining.tonight)],
      ['Via Verde tomorrow', pounds(dining.tomorrow)],
      ['Little Olive pasta tomorrow', pounds(dining.alternative)],
      ['Left with the cheaper plan', pounds(diningLeft - cheaperPlan)],
    ],
    next: 'Little Olive also serves pasta. In this example it keeps both nights within your dining budget.',
    assumptions: 'Restaurant names and menu prices are fictional. Estimates are per person and assume the same meal and drink order. Travel and optional tips are separate.',
  },
  health: {
    question: 'How are my finances looking over the past year?',
    steps: ['Reviewed 12 months of sample transactions', 'Separated transfers from spending', 'Compared categories with recent averages'],
    title: 'You spent less than you earned last month',
    answer: `You had ${pounds(lastIncome - lastMonth)} left after spending last month. Spending was ${pounds(lastMonth - Math.round(sixMonths / 6))} above your six-month average. Housing and bills were your biggest category. Food and dining were ${pounds(categories[1][1] - priorDining)} above their previous five-month average.`,
    rows: [
      ['Last month · total', pounds(lastMonth)],
      ['Last six months · monthly average', pounds(sixMonths / 6)],
      ['Last year · monthly average', pounds(fullYear / 12)],
      ...categories.map(([label, amount]) => [label, pounds(amount)]),
    ],
    next: 'Try a £350 food and dining target next month. Matching it would free £40 at last month’s spending level.',
    assumptions: `Six-month total: ${pounds(sixMonths)}. Twelve-month total: ${pounds(fullYear)}. One sample account is included. Transfers between your own accounts are excluded. A positive monthly balance does not account for bills outside the sample.`,
  },
}
