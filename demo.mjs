import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'

const scenarios = {
  adult: { currency: 'GBP', balance: 120000, commitments: 81000, reserve: 15000 },
  teen: { currency: 'GBP', balance: 8500, commitments: 2000, reserve: 2500 },
}

function parseAmount(input) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(input.trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

const terminal = createInterface({ input: stdin, output: stdout })
const lines = terminal[Symbol.asyncIterator]()
async function prompt(label) {
  stdout.write(label)
  const { value = '' } = await lines.next()
  return value
}

try {
  console.log('Money coach demo · fictional data only')
  const mode = (await prompt('Choose adult or teen: ')).trim().toLowerCase()
  if (mode !== 'adult' && mode !== 'teen') {
    console.log('Choose adult or teen to try a demo.')
    process.exitCode = 1
  } else {
    const scenario = scenarios[mode]
    const format = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: scenario.currency,
    })
    const money = (minorUnits) => format.format(minorUnits / 100)
    const nextIncome = mode === 'adult' ? 'payday' : 'your next pocket money'
    console.log(
      mode === 'adult'
        ? 'Demo approval would read one sample account snapshot.'
        : 'This example uses fictional pocket money and a savings goal.',
    )
    const choice = (await prompt('Type yes to use the sample: ')).trim()
    if (choice.toLowerCase() !== 'yes') {
      console.log('Check cancelled.')
    } else {
      const amount = parseAmount(await prompt('Purchase amount in GBP: '))
      if (amount === null) {
        console.log('Enter an amount like 45 or 45.50.')
        process.exitCode = 1
      } else {
        const available = scenario.balance - scenario.commitments - scenario.reserve
        const remaining = available - amount
        console.log(
          remaining >= 0
            ? `This would leave ${money(remaining)} until ${nextIncome}.`
            : `This would put you ${money(-remaining)} short of your plan before ${nextIncome}.`,
        )
        console.log(
          `${money(scenario.balance)} balance − ${money(scenario.commitments)} committed ` +
            `− ${money(scenario.reserve)} set aside − ${money(amount)} purchase.`,
        )
      }
    }
  }
} finally {
  terminal.close()
}
