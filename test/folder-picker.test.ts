import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFolderPickerInvocation, supportsFolderPicker } from '../src/system/folder-picker.js';

test('buildFolderPickerInvocation uses osascript on macOS when available', () => {
  const invocation = buildFolderPickerInvocation(
    'darwin',
    {
      prompt: 'Choose a folder',
      initialPath: '/Users/example/Music',
    },
    (command) => command === 'osascript',
  );

  assert.deepEqual(invocation, {
    command: 'osascript',
    args: [
      '-e',
      'POSIX path of (choose folder with prompt "Choose a folder" default location POSIX file "/Users/example/Music")',
    ],
  });
});

test('buildFolderPickerInvocation prefers zenity on linux', () => {
  const invocation = buildFolderPickerInvocation(
    'linux',
    {
      prompt: 'Select a folder',
      initialPath: '/home/example/Music',
    },
    (command) => command === 'zenity' || command === 'kdialog',
  );

  assert.deepEqual(invocation, {
    command: 'zenity',
    args: [
      '--file-selection',
      '--directory',
      '--title=Select a folder',
      '--filename=/home/example/Music',
    ],
  });
});

test('supportsFolderPicker reports false when no supported picker exists', () => {
  assert.equal(supportsFolderPicker('linux', () => false), false);
  assert.equal(buildFolderPickerInvocation('win32', {}, () => true), null);
});
