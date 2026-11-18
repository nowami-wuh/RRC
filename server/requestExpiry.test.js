import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getElapsedBusinessDays,
  hasEventDatePassed,
  hasFiveBusinessDaysElapsed,
} from './requestExpiry.js';

test('business-day age skips weekends and expires at five business days', () => {
  const monday = new Date(2026, 10, 16, 12);

  assert.equal(getElapsedBusinessDays(new Date(2026, 10, 13, 12), monday), 1);
  assert.equal(getElapsedBusinessDays(new Date(2026, 10, 9, 12), monday), 5);
  assert.equal(hasFiveBusinessDaysElapsed(new Date(2026, 10, 9, 12), monday), true);
  assert.equal(hasFiveBusinessDaysElapsed(new Date(2026, 10, 10, 12), monday), false);
});

test('event-date expiry uses the end date for multi-day events', () => {
  const today = new Date(2026, 10, 18, 12);

  assert.equal(hasEventDatePassed({ date: '2026-11-17' }, today), true);
  assert.equal(hasEventDatePassed({ date: '2026-11-18' }, today), false);
  assert.equal(hasEventDatePassed({ date: '2026-11-17', endDate: '2026-11-20' }, today), false);
});
