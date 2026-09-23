import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandEventsForWindow,
  detectCalendarConflicts,
  syncTimetableToCalendarEvents,
  generateIcsCalendar,
  EVENT_TYPE_METADATA,
} from '../src/lib/calendar/calendar-model.ts';

test('Smart Academic Calendar: Recurrence expansion expands weekly and daily rules correctly without duplicate master events', () => {
  const masterEvent = {
    id: 'cal_math_1',
    type: 'academic',
    title: 'Advanced Mathematics',
    startAt: '2026-09-01T09:00:00.000Z',
    endAt: '2026-09-01T10:30:00.000Z',
    allDay: false,
    source: 'timetable',
    priority: 'high',
    status: 'confirmed',
    recurrenceRule: {
      frequency: 'weekly',
      daysOfWeek: [2], // Tuesday
      until: '2026-09-30',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const windowStart = new Date('2026-09-01T00:00:00.000Z');
  const windowEnd = new Date('2026-09-30T23:59:59.999Z');

  const instances = expandEventsForWindow([masterEvent], windowStart, windowEnd);

  // Tuesdays in September 2026: Sept 1, 8, 15, 22, 29 (5 instances)
  assert.equal(instances.length, 5, 'Should generate exactly 5 weekly instances for September 2026');
  assert.equal(instances[0].masterEventId, 'cal_math_1');
  assert.equal(instances[0].isRecurringInstance, false); // First instance is origStart
  assert.equal(instances[1].isRecurringInstance, true);
});

test('Smart Academic Calendar: Interval Conflict Detector detects overlapping classes deterministically', () => {
  const eventA = {
    id: 'evt_a',
    type: 'academic',
    title: 'Data Structures',
    startAt: '2026-09-24T09:00:00.000Z',
    endAt: '2026-09-24T10:00:00.000Z',
    allDay: false,
    source: 'manual',
    priority: 'high',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const eventB = {
    id: 'evt_b',
    type: 'study_session',
    title: 'Web Development Lab',
    startAt: '2026-09-24T09:30:00.000Z',
    endAt: '2026-09-24T10:30:00.000Z',
    allDay: false,
    source: 'manual',
    priority: 'medium',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const eventC = {
    id: 'evt_c',
    type: 'interview',
    title: 'Technical Interview',
    startAt: '2026-09-24T11:00:00.000Z',
    endAt: '2026-09-24T12:00:00.000Z',
    allDay: false,
    source: 'career',
    priority: 'high',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const windowStart = new Date('2026-09-24T00:00:00.000Z');
  const windowEnd = new Date('2026-09-24T23:59:59.999Z');

  const instances = expandEventsForWindow([eventA, eventB, eventC], windowStart, windowEnd);
  const conflictResult = detectCalendarConflicts(instances);

  assert.equal(conflictResult.hasAnyConflict, true, 'Should detect overlap between Event A and Event B');
  assert.equal(conflictResult.conflictingIds.has('evt_a'), true);
  assert.equal(conflictResult.conflictingIds.has('evt_b'), true);
  assert.equal(conflictResult.conflictingIds.has('evt_c'), false, 'Event C at 11:00 does not conflict');
});

test('Smart Academic Calendar: Timetable synchronization updates generated events while preserving manual events', () => {
  const manualEvent = {
    id: 'manual_1',
    type: 'assignment',
    title: 'Submit OS Assignment',
    startAt: '2026-09-25T14:00:00.000Z',
    endAt: '2026-09-25T15:00:00.000Z',
    allDay: false,
    source: 'manual',
    priority: 'high',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const timetableEntries = [
    {
      id: 'tt_algo',
      day: 'Monday',
      subject: 'Algorithms',
      startTime: '09:00',
      endTime: '10:30',
      room: 'LH-101',
      teacher: 'Dr. Sharma',
    },
    {
      id: 'tt_dbms',
      day: 'Wednesday',
      subject: 'Database Systems',
      startTime: '11:00',
      endTime: '12:30',
      room: 'Lab 2',
    },
  ];

  const synced = syncTimetableToCalendarEvents(timetableEntries, [manualEvent], '2026-12-31');

  assert.equal(synced.length, 3, 'Should retain manual event and append 2 generated timetable events');
  assert.ok(synced.some((e) => e.id === 'manual_1'), 'Manual event must be preserved');
  assert.ok(synced.some((e) => e.id === 'cal_tt_tt_algo' && e.source === 'timetable'));
  assert.ok(synced.some((e) => e.id === 'cal_tt_tt_dbms' && e.source === 'timetable'));

  // Now delete tt_algo from timetable
  const updatedTimetable = [timetableEntries[1]];
  const reSynced = syncTimetableToCalendarEvents(updatedTimetable, synced, '2026-12-31');

  assert.equal(reSynced.length, 2, 'Should only contain manual event and remaining timetable event');
  assert.ok(reSynced.some((e) => e.id === 'manual_1'));
  assert.ok(reSynced.some((e) => e.id === 'cal_tt_tt_dbms'));
  assert.ok(!reSynced.some((e) => e.id === 'cal_tt_tt_algo'), 'Deleted timetable event should be cleanly purged');
});

test('Smart Academic Calendar: RFC 5545 iCalendar (.ics) export generates valid schema client-side', () => {
  const events = [
    {
      id: 'ics_evt_1',
      type: 'exam',
      title: 'Final Examination — Computer Networks',
      description: 'Covers units 1 to 5. Bring ID card and admit ticket.',
      location: 'Block B, Exam Hall 3',
      startAt: '2026-10-15T09:30:00.000Z',
      endAt: '2026-10-15T12:30:00.000Z',
      allDay: false,
      source: 'academic',
      priority: 'high',
      status: 'confirmed',
      reminderMinutesBefore: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const icsOutput = generateIcsCalendar(events, 'My Saarvi Calendar');

  assert.ok(icsOutput.includes('BEGIN:VCALENDAR'), 'ICS must include standard header');
  assert.ok(icsOutput.includes('VERSION:2.0'), 'ICS must specify version 2.0');
  assert.ok(icsOutput.includes('SUMMARY:Final Examination — Computer Networks'));
  assert.ok(icsOutput.includes('LOCATION:Block B\\, Exam Hall 3'), 'Commas in location must be escaped');
  assert.ok(icsOutput.includes('BEGIN:VALARM'), 'Should include alarm reminder');
  assert.ok(icsOutput.includes('TRIGGER:-PT30M'), 'Reminder trigger should match 30 minutes');
  assert.ok(icsOutput.includes('END:VCALENDAR'), 'ICS must end with VCALENDAR tag');
});
