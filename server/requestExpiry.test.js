import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getElapsedBusinessDays,
  hasEventDatePassed,
  hasFiveBusinessDaysElapsed,
} from './requestExpiry.js';
import { hasEventEnded } from './eventStatus.js';

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

test('completed status begins at the event end time in Manila', () => {
  const event = { date: '2026-11-18', timeEnd: '10:00PM' };

  assert.equal(hasEventEnded(event, new Date('2026-11-18T13:59:59.999Z')), false);
  assert.equal(hasEventEnded(event, new Date('2026-11-18T14:00:00.000Z')), true);
});

test('event completion uses the final date and end time for multi-day events', () => {
  const event = {
    date: 'November 18, 2026',
    endDate: 'November 19, 2026',
    timeEnd: '1:00AM',
  };

  assert.equal(hasEventEnded(event, new Date('2026-11-18T16:59:59.999Z')), false);
  assert.equal(hasEventEnded(event, new Date('2026-11-18T17:00:00.000Z')), true);
});

test('events without an end time complete after their final date', () => {
  const event = { date: '2026-11-18' };

  assert.equal(hasEventEnded(event, new Date('2026-11-18T15:59:59.999Z')), false);
  assert.equal(hasEventEnded(event, new Date('2026-11-18T16:00:00.000Z')), true);
});
