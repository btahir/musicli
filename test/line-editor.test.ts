import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backspaceLineEditor,
  clearLineEditorToEnd,
  clearLineEditorToStart,
  createLineEditor,
  deleteLineEditorForward,
  insertLineEditorText,
  moveLineEditorEnd,
  moveLineEditorHome,
  moveLineEditorLeft,
  moveLineEditorRight,
  projectLineEditor,
} from '../src/ui/line-editor.js';

test('line editor inserts text at the cursor and supports backspace/delete', () => {
  let editor = createLineEditor('lofiroom');
  editor = moveLineEditorHome(editor);
  editor = moveLineEditorRight(moveLineEditorRight(moveLineEditorRight(moveLineEditorRight(editor))));
  editor = insertLineEditorText(editor, '-');
  assert.deepEqual(editor, { value: 'lofi-room', cursor: 5 });

  editor = backspaceLineEditor(editor);
  assert.deepEqual(editor, { value: 'lofiroom', cursor: 4 });

  editor = moveLineEditorLeft(editor);
  editor = deleteLineEditorForward(editor);
  assert.deepEqual(editor, { value: 'lofroom', cursor: 3 });
});

test('line editor supports home/end style clears', () => {
  let editor = createLineEditor('https://example.com/live');
  editor = moveLineEditorHome(editor);
  editor = clearLineEditorToEnd(editor);
  assert.deepEqual(editor, { value: '', cursor: 0 });

  editor = createLineEditor('/Users/example/Music/Lofi');
  editor = moveLineEditorHome(editor);
  editor = moveLineEditorRight(moveLineEditorRight(editor));
  editor = clearLineEditorToStart(editor);
  assert.deepEqual(editor, { value: 'sers/example/Music/Lofi', cursor: 0 });
});

test('line editor clamps stale cursor positions before editing', () => {
  let editor = insertLineEditorText({ value: 'lofi', cursor: 99 }, '-room');
  assert.deepEqual(editor, { value: 'lofi-room', cursor: 9 });

  editor = backspaceLineEditor({ value: 'lofi-room', cursor: 99 });
  assert.deepEqual(editor, { value: 'lofi-roo', cursor: 8 });

  editor = deleteLineEditorForward({ value: 'lofi-room', cursor: -5 });
  assert.deepEqual(editor, { value: 'ofi-room', cursor: 0 });
});

test('line editor cursor movement clamps at both ends', () => {
  let editor = moveLineEditorLeft({ value: 'beats', cursor: -4 });
  assert.deepEqual(editor, { value: 'beats', cursor: 0 });

  editor = moveLineEditorEnd(editor);
  assert.deepEqual(editor, { value: 'beats', cursor: 5 });

  editor = moveLineEditorRight({ value: 'beats', cursor: 99 });
  assert.deepEqual(editor, { value: 'beats', cursor: 5 });
});

test('projectLineEditor keeps the caret visible inside narrow fields', () => {
  const editor = createLineEditor('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const projected = projectLineEditor(editor, 16, 'https://...');

  assert.equal(projected.text.length, 16);
  assert.ok(projected.cursorX >= 0 && projected.cursorX <= 16);
});

test('projectLineEditor falls back to placeholder when empty', () => {
  const projected = projectLineEditor(createLineEditor(''), 12, '/path/to/music');
  assert.equal(projected.text, '/path/to/mus');
  assert.equal(projected.cursorX, 0);
});
