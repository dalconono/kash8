// All amounts are integer pence. Cash excludes overdraft and reflects pending activity
// to the extent provided by the bank. Bills must exclude amounts already reflected in cash.
const fields = {
  cash: 'How much usable cash do you have now?',
  bills: 'How much is still due before your next income, excluding payments already reflected in that balance?',
  buffer: 'How much cash do you want to keep untouched?',
  price: 'What is the full upfront cost, including fees?',
}
const recurringFields = {
  monthlyCost: 'What will this cost each month, including fees and running costs?',
  monthlySpare: 'How much is normally left each month after bills, debt payments and planned savings?',
}
const maximum = 1e12
const valid = (value, signed = false) => Number.isSafeInteger(value) &&
  value >= (signed ? -maximum : 0) && value <= maximum

export function purchaseDecision(input) {
  if (!['one-off', 'recurring', 'unknown'].includes(input.commitment)) {
    throw new TypeError('Choose a valid commitment type')
  }
  const required = input.commitment === 'recurring' ? { ...fields, ...recurringFields } : fields
  for (const key of Object.keys(required)) {
    if (input[key] != null && !valid(input[key], key === 'cash' || key === 'monthlySpare')) {
      throw new RangeError(`Invalid amount for ${key}`)
    }
  }
  if (input.commitment === 'unknown') {
    return { status: 'needs-input', field: 'commitment', question: 'Is this a one-off purchase or will you also pay for it each month?' }
  }
  const missing = Object.keys(required).find((key) => input[key] == null)
  if (missing) return { status: 'needs-input', field: missing, question: required[missing] }

  const { cash, bills, buffer, price, monthlyCost, monthlySpare } = input
  const cashHeadroom = cash - bills - buffer - price
  const monthlyHeadroom = input.commitment === 'recurring' ? monthlySpare - monthlyCost : null
  const status = cashHeadroom < 0 || (monthlyHeadroom !== null && monthlyHeadroom < 0)
    ? 'over-budget'
    : cashHeadroom === 0 || monthlyHeadroom === 0 ? 'at-limit' : 'fits'
  return {
    status, cashHeadroom, monthlyHeadroom,
    upfrontLimit: Math.max(0, cash - bills - buffer),
    monthlyLimit: monthlyHeadroom === null ? null : Math.max(0, monthlySpare),
  }
}
