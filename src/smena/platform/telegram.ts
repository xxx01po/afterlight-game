/**
 * Telegram Mini Apps integration. Entirely optional: the SDK script is loaded
 * only when the page is opened inside Telegram, every call is feature-checked
 * by Bot API version, and the game runs unchanged in a regular browser.
 */
interface TgInset { top: number; bottom: number; left: number; right: number }
interface TgBackButton { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
interface TgHaptic {
  impactOccurred(s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(t: 'error' | 'success' | 'warning'): void;
}
export interface TgWebApp {
  version: string;
  platform: string;
  isFullscreen?: boolean;
  safeAreaInset?: TgInset;
  contentSafeAreaInset?: TgInset;
  initDataUnsafe?: { user?: { first_name?: string; language_code?: string } };
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  requestFullscreen?(): void;
  lockOrientation?(): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation?(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  setBottomBarColor?(c: string): void;
  onEvent(e: string, cb: () => void): void;
  BackButton?: TgBackButton;
  HapticFeedback?: TgHaptic;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
    TelegramWebviewProxy?: unknown;
  }
}

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js?59';

export function isInsideTelegram() {
  const h = location.hash + location.search;
  if (/tgWebApp(Data|Version|Platform)/.test(h)) return true;
  try {
    if (sessionStorage.getItem('__telegram__initParams')) return true;
  } catch {
    /* ignore */
  }
  return typeof window.TelegramWebviewProxy !== 'undefined';
}

function loadScript(src: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    s.onload = () => {
      clearTimeout(t);
      resolve();
    };
    s.onerror = () => {
      clearTimeout(t);
      reject(new Error('load failed'));
    };
    document.head.appendChild(s);
  });
}

class TelegramBridge {
  app: TgWebApp | null = null;
  private backHandler: (() => void) | null = null;

  async init() {
    if (!isInsideTelegram()) return false;
    try {
      if (!window.Telegram?.WebApp) await loadScript(SDK_URL, 6000);
    } catch {
      return false;
    }
    const app = window.Telegram?.WebApp;
    if (!app) return false;
    this.app = app;
    document.documentElement.classList.add('tg');
    try {
      app.ready();
      app.expand();
      const v = (x: string) => app.isVersionAtLeast(x);
      if (v('6.1')) {
        app.setHeaderColor?.('#050607');
        app.setBackgroundColor?.('#050607');
      }
      if (v('7.7')) app.disableVerticalSwipes?.();
      if (v('7.10')) app.setBottomBarColor?.('#050607');
      if (v('8.0')) {
        // Landscape game: ask Telegram for fullscreen + orientation lock on phones.
        if (/android|ios/i.test(app.platform)) {
          app.requestFullscreen?.();
          app.lockOrientation?.();
        }
      }
      if (v('6.2')) app.enableClosingConfirmation?.();
      const applyInsets = () => this.applyInsets();
      app.onEvent('safeAreaChanged', applyInsets);
      app.onEvent('contentSafeAreaChanged', applyInsets);
      app.onEvent('fullscreenChanged', applyInsets);
      app.onEvent('viewportChanged', applyInsets);
      applyInsets();
    } catch {
      /* partial support is fine */
    }
    return true;
  }

  /** Telegram reports its own chrome separately from device safe areas — combine both into CSS variables. */
  private applyInsets() {
    const a = this.app;
    if (!a) return;
    const s = a.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
    const c = a.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
    const r = document.documentElement.style;
    r.setProperty('--tg-top', `${(s.top || 0) + (c.top || 0)}px`);
    r.setProperty('--tg-bottom', `${(s.bottom || 0) + (c.bottom || 0)}px`);
    r.setProperty('--tg-left', `${(s.left || 0) + (c.left || 0)}px`);
    r.setProperty('--tg-right', `${(s.right || 0) + (c.right || 0)}px`);
  }

  get userName() {
    return this.app?.initDataUnsafe?.user?.first_name;
  }

  setBack(handler: (() => void) | null) {
    const b = this.app?.BackButton;
    if (!b || !this.app?.isVersionAtLeast('6.1')) return;
    if (this.backHandler) b.offClick(this.backHandler);
    this.backHandler = handler;
    if (handler) {
      b.onClick(handler);
      b.show();
    } else b.hide();
  }

  haptic(kind: 'light' | 'medium' | 'heavy' | 'error' | 'warning') {
    const h = this.app?.HapticFeedback;
    if (h && this.app?.isVersionAtLeast('6.1')) {
      try {
        if (kind === 'error' || kind === 'warning') h.notificationOccurred(kind);
        else h.impactOccurred(kind);
      } catch {
        /* ignore */
      }
      return;
    }
    // Browser fallback (Android Chrome); iOS Safari has no vibration API.
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(kind === 'heavy' || kind === 'error' ? 60 : kind === 'medium' ? 30 : 12);
      } catch {
        /* ignore */
      }
    }
  }
}

export const telegram = new TelegramBridge();
