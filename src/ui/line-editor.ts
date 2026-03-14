export interface LineEditorState {
  value: string;
  cursor: number;
}

function clampCursor(value: string, cursor: number): number {
  return Math.max(0, Math.min(cursor, value.length));
}

function normalizeLineEditorState(state: LineEditorState): LineEditorState {
  const cursor = clampCursor(state.value, state.cursor);
  if (cursor === state.cursor) return state;
  return {
    value: state.value,
    cursor,
  };
}

export function createLineEditor(value = ''): LineEditorState {
  return {
    value,
    cursor: value.length,
  };
}

export function setLineEditorValue(state: LineEditorState, value: string): LineEditorState {
  return {
    value,
    cursor: clampCursor(value, state.cursor),
  };
}

export function insertLineEditorText(state: LineEditorState, text: string): LineEditorState {
  if (!text) return state;
  const normalized = normalizeLineEditorState(state);
  return {
    value: `${normalized.value.slice(0, normalized.cursor)}${text}${normalized.value.slice(normalized.cursor)}`,
    cursor: normalized.cursor + text.length,
  };
}

export function backspaceLineEditor(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  if (normalized.cursor <= 0) return normalized;
  return {
    value: `${normalized.value.slice(0, normalized.cursor - 1)}${normalized.value.slice(normalized.cursor)}`,
    cursor: normalized.cursor - 1,
  };
}

export function deleteLineEditorForward(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  if (normalized.cursor >= normalized.value.length) return normalized;
  return {
    value: `${normalized.value.slice(0, normalized.cursor)}${normalized.value.slice(normalized.cursor + 1)}`,
    cursor: normalized.cursor,
  };
}

export function moveLineEditorLeft(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  return {
    value: normalized.value,
    cursor: clampCursor(normalized.value, normalized.cursor - 1),
  };
}

export function moveLineEditorRight(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  return {
    value: normalized.value,
    cursor: clampCursor(normalized.value, normalized.cursor + 1),
  };
}

export function moveLineEditorHome(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  return {
    value: normalized.value,
    cursor: 0,
  };
}

export function moveLineEditorEnd(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  return {
    value: normalized.value,
    cursor: normalized.value.length,
  };
}

export function clearLineEditorToStart(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  if (normalized.cursor <= 0) return normalized;
  return {
    value: normalized.value.slice(normalized.cursor),
    cursor: 0,
  };
}

export function clearLineEditorToEnd(state: LineEditorState): LineEditorState {
  const normalized = normalizeLineEditorState(state);
  if (normalized.cursor >= normalized.value.length) return normalized;
  return {
    value: normalized.value.slice(0, normalized.cursor),
    cursor: normalized.cursor,
  };
}

export interface VisibleLineEditor {
  text: string;
  cursorX: number;
}

export function projectLineEditor(
  state: LineEditorState,
  width: number,
  placeholder = '',
): VisibleLineEditor {
  if (width <= 0) return { text: '', cursorX: 0 };

  if (!state.value) {
    return {
      text: placeholder.slice(0, width),
      cursorX: 0,
    };
  }

  const cursor = clampCursor(state.value, state.cursor);
  let start = 0;
  if (state.value.length > width) {
    start = Math.max(0, cursor - Math.floor(width / 2));
    start = Math.min(start, Math.max(0, state.value.length - width));
  }

  return {
    text: state.value.slice(start, start + width),
    cursorX: clampCursor(state.value.slice(start, start + width), cursor - start),
  };
}
