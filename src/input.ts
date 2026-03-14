type KeyHandler = () => void;
type AnyKeyHandler = (key: string) => boolean | void;

const handlers = new Map<string, KeyHandler>();
const anyKeyHandlers: AnyKeyHandler[] = [];

const KEY_MAP: Record<string, string> = {
  '\x1b': 'esc',
  '\x1b[A': 'up',
  '\x1b[B': 'down',
  '\x1b[C': 'right',
  '\x1b[D': 'left',
  '\x1b[3~': 'delete',
  '\x1bOH': 'home',
  '\x1bOF': 'end',
  '\x1b[H': 'home',
  '\x1b[F': 'end',
  '\x1b[1~': 'home',
  '\x1b[4~': 'end',
  '\x1b[7~': 'home',
  '\x1b[8~': 'end',
  '\x03': 'ctrl-c',
  '\x01': 'ctrl-a',
  '\x05': 'ctrl-e',
  '\x0b': 'ctrl-k',
  '\x15': 'ctrl-u',
  '\r': 'enter',
  '\n': 'enter',
  '\x08': 'backspace',
  '\x7f': 'backspace',
  '\t': '\t',
  '\x1b[Z': 'shift-tab',
  '\x1b[1;2Z': 'shift-tab',
};
const KEY_SEQUENCES = Object.keys(KEY_MAP).sort((a, b) => b.length - a.length);

export function onKey(key: string, handler: KeyHandler): void {
  handlers.set(key, handler);
}

export function onAnyKey(handler: AnyKeyHandler): void {
  anyKeyHandlers.push(handler);
}

export function parseInputKeys(raw: string): string[] {
  const parsed: string[] = [];

  for (let i = 0; i < raw.length;) {
    let matched = false;

    for (const sequence of KEY_SEQUENCES) {
      if (!raw.startsWith(sequence, i)) continue;
      parsed.push(KEY_MAP[sequence]);
      i += sequence.length;
      matched = true;
      break;
    }

    if (matched) continue;

    parsed.push(raw[i]);
    i += 1;
  }

  return parsed;
}

export function startInput(): void {
  process.stdin.on('data', (data: Buffer) => {
    for (const key of parseInputKeys(data.toString())) {
      let handled = false;
      for (const anyKeyHandler of anyKeyHandlers) {
        if (anyKeyHandler(key)) {
          handled = true;
          break;
        }
      }
      if (handled) continue;

      const h = handlers.get(key);
      if (h) h();
    }
  });
}
