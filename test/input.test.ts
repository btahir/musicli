import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInputKeys } from '../src/input.js';

test('parseInputKeys keeps escape sequences intact inside mixed input chunks', () => {
  assert.deepEqual(
    parseInputKeys('\x1b[A+\x1b[1;2Zq'),
    ['up', '+', 'shift-tab', 'q'],
  );
});

test('parseInputKeys handles back-to-back arrow sequences', () => {
  assert.deepEqual(parseInputKeys('\x1b[A\x1b[B\x1b[C'), ['up', 'down', 'right']);
});

test('parseInputKeys exposes overlay control keys', () => {
  assert.deepEqual(parseInputKeys('/?\x7f\r\x1b'), ['/', '?', 'backspace', 'enter', 'esc']);
});

test('parseInputKeys recognizes terminal line-editing keys', () => {
  assert.deepEqual(
    parseInputKeys('\x1b[3~\x1b[H\x1b[F\x01\x05\x15\x0b'),
    ['delete', 'home', 'end', 'ctrl-a', 'ctrl-e', 'ctrl-u', 'ctrl-k'],
  );
});

test('parseInputKeys supports alternate home/end and backspace sequences', () => {
  assert.deepEqual(
    parseInputKeys('\x1bOH\x1bOF\x08\x7f'),
    ['home', 'end', 'backspace', 'backspace'],
  );
});
