import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { shareToWhatsApp } from '@/utils/planningMessage';

const TEXT = 'Robin De Wolf (6u)\nmaandag: werven';
const WA_ME = `https://wa.me/?text=${encodeURIComponent(TEXT)}`;

// jsdom has no matchMedia or navigator.share — stub both per test.
function setPointer(coarse: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function setShare(impl: (() => Promise<void>) | undefined) {
  const share = impl ? vi.fn(impl) : undefined;
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  return share;
}

let open: MockInstance<typeof window.open>;

beforeEach(() => {
  open = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'share');
});

describe('shareToWhatsApp', () => {
  it('desktop (fine pointer) opens wa.me even when navigator.share exists', async () => {
    setPointer(false);
    const share = setShare(() => Promise.resolve());
    await shareToWhatsApp(TEXT);
    expect(share).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(WA_ME, '_blank', 'noopener');
  });

  it('phone (coarse pointer) uses the native share sheet, not wa.me', async () => {
    setPointer(true);
    const share = setShare(() => Promise.resolve());
    await shareToWhatsApp(TEXT);
    expect(share).toHaveBeenCalledWith({ text: TEXT });
    expect(open).not.toHaveBeenCalled();
  });

  it('phone: cancelling the sheet (AbortError) opens nothing', async () => {
    setPointer(true);
    const share = setShare(() => Promise.reject(new DOMException('cancelled', 'AbortError')));
    await shareToWhatsApp(TEXT);
    expect(share).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it('phone: any other share failure falls back to wa.me', async () => {
    setPointer(true);
    setShare(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    await shareToWhatsApp(TEXT);
    expect(open).toHaveBeenCalledWith(WA_ME, '_blank', 'noopener');
  });

  it('no navigator.share opens wa.me', async () => {
    setPointer(true);
    setShare(undefined);
    await shareToWhatsApp(TEXT);
    expect(open).toHaveBeenCalledWith(WA_ME, '_blank', 'noopener');
  });

  it('no matchMedia at all is treated as desktop', async () => {
    Reflect.deleteProperty(window, 'matchMedia');
    const share = setShare(() => Promise.resolve());
    await shareToWhatsApp(TEXT);
    expect(share).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(WA_ME, '_blank', 'noopener');
  });
});
