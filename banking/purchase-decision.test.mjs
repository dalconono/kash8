import assert from 'node:assert/strict'
import test from 'node:test'
import { purchaseDecision } from './purchase-decision.mjs'

const budget = { cash: 120000, bills: 81000, buffer: 15000, commitment: 'one-off' }

test('purchase checks distinguish room, an exact limit and a shortfall', () => {
  assert.deepEqual(purchaseDecision({ ...budget, price: 18000 }), {
    status: 'fits', cashHeadroom: 6000, monthlyHeadroom: null, upfrontLimit: 24000, monthlyLimit: null,
  })
  assert.equal(purchaseDecision({ ...budget, price: 24000 }).status, 'at-limit')
  assert.equal(purchaseDecision({ ...budget, price: 24001 }).cashHeadroom, -1)
  assert.equal(purchaseDecision({ ...budget, cash: -5, price: 0 }).upfrontLimit, 0)
})

test('a recurring purchase can pass the upfront test and still strain monthly cash flow', () => {
  assert.deepEqual(purchaseDecision({
    ...budget, commitment: 'recurring', price: 18000, monthlyCost: 22000, monthlySpare: 20000,
  }), {
    status: 'over-budget', cashHeadroom: 6000, monthlyHeadroom: -2000, upfrontLimit: 24000, monthlyLimit: 20000,
  })
})

test('questions identify missing inputs without assuming zero', () => {
  assert.equal(purchaseDecision({ ...budget, commitment: 'unknown' }).field, 'commitment')
  assert.equal(purchaseDecision({ ...budget, bills: null, price: 100 }).field, 'bills')
  assert.equal(purchaseDecision({ ...budget, commitment: 'recurring', price: 0, monthlyCost: 0 }).field, 'monthlySpare')
  assert.throws(() => purchaseDecision({ ...budget, price: 199.5 }), RangeError)
})
