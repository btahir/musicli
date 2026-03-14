const ALT_SCREEN_ON = '\x1b[?1049h';
const ALT_SCREEN_OFF = '\x1b[?1049l';
const CURSOR_HIDE = '\x1b[?25l';
const CURSOR_SHOW = '\x1b[?25h';
const CLEAR_SCREEN = '\x1b[2J\x1b[H';

let entered = false;
let resizeHandler: (() => void) | null = null;

export function enterTerminal(onResize?: () => void): void {
  if (entered) return;
  entered = true;

  process.stdout.write(ALT_SCREEN_ON + CURSOR_HIDE + CLEAR_SCREEN);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  if (onResize) {
    resizeHandler = onResize;
    process.stdout.on('resize', resizeHandler);
  }

  const cleanup = () => exitTerminal();
  process.on('exit', cleanup);
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
}

export function exitTerminal(): void {
  if (!entered) return;
  entered = false;

  if (resizeHandler) {
    process.stdout.removeListener('resize', resizeHandler);
    resizeHandler = null;
  }

  process.stdout.write(CURSOR_SHOW + ALT_SCREEN_OFF);

  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    } catch {}
    process.stdin.pause();
  }
}

export function cols(): number {
  return process.stdout.columns || 80;
}

export function rows(): number {
  return process.stdout.rows || 24;
}
