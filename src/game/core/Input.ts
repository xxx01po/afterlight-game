import { useSettings } from '@/game/state/settings';

export interface JoyState { active: boolean; ox: number; oy: number; x: number; y: number }

/**
 * Touch: floating joystick on the left 45% of the screen, swipe-look on the rest.
 * Desktop: WASD/arrows + mouse (pointer lock on click), E interact, F flashlight,
 * Tab/Q phone, Esc pause.
 */
export class Input {
  /** Movement intent, -1..1 (x = strafe right, y = forward). */
  move = { x: 0, y: 0 };
  /** Accumulated look delta in radians since last consume(). */
  private look = { x: 0, y: 0 };
  joy: JoyState = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  onJoy?: (j: JoyState) => void;
  onAction?: (a: 'interact' | 'flashlight' | 'phone' | 'pause') => void;
  enabled = true;
  private joyId: number | null = null;
  private lookId: number | null = null;
  private lastLook = { x: 0, y: 0 };
  private keys = new Set<string>();
  private readonly radius = 56;
  usingTouch = false;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.moveH, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.reset);
    document.addEventListener('mousemove', this.mouseLock);
  }

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.usingTouch = true;
    if (!this.enabled) return;
    const w = window.innerWidth;
    if (e.pointerType !== 'mouse' && e.clientX < w * 0.45 && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joy = { active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.onJoy?.(this.joy);
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lastLook = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'mouse' && !document.pointerLockElement && !this.usingTouch) {
        this.el.requestPointerLock?.()?.catch?.(() => {});
      }
    }
    e.preventDefault();
  };

  private moveH = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) {
        // floating base follows the finger
        this.joy.ox += (dx / d) * (d - this.radius);
        this.joy.oy += (dy / d) * (d - this.radius);
        dx = e.clientX - this.joy.ox;
        dy = e.clientY - this.joy.oy;
      }
      this.joy.x = dx / this.radius;
      this.joy.y = dy / this.radius;
      this.onJoy?.(this.joy);
      e.preventDefault();
    } else if (e.pointerId === this.lookId && !document.pointerLockElement) {
      const s = useSettings.getState();
      const k = 0.0042 * s.lookSensitivity;
      this.look.x += (e.clientX - this.lastLook.x) * k;
      this.look.y += (e.clientY - this.lastLook.y) * k * (s.invertY ? -1 : 1);
      this.lastLook = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  private mouseLock = (e: MouseEvent) => {
    if (!document.pointerLockElement || !this.enabled) return;
    const s = useSettings.getState();
    const k = 0.0022 * s.lookSensitivity;
    this.look.x += e.movementX * k;
    this.look.y += e.movementY * k * (s.invertY ? -1 : 1);
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.joy = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
      this.onJoy?.(this.joy);
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  };

  private keyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'tab') e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (k === 'escape') this.onAction?.('pause');
    if (!this.enabled && k !== 'e' && k !== 'enter' && k !== ' ') return;
    if (e.code === 'KeyE' || k === 'enter') this.onAction?.('interact');
    if (e.code === 'KeyF') this.onAction?.('flashlight');
    if (e.code === 'Tab' || e.code === 'KeyQ') this.onAction?.('phone');
  };
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  reset = () => {
    this.keys.clear();
    this.joyId = this.lookId = null;
    this.joy = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.onJoy?.(this.joy);
    this.look.x = this.look.y = 0;
  };

  /** Compute movement vector for this frame. */
  update() {
    let x = 0, y = 0;
    if (this.joy.active) {
      x = this.joy.x;
      y = -this.joy.y;
      const m = Math.hypot(x, y);
      if (m < 0.12) x = y = 0; // dead zone
      else if (m > 1) {
        x /= m;
        y /= m;
      }
    }
    const K = this.keys;
    if (K.has('KeyW') || K.has('ArrowUp')) y += 1;
    if (K.has('KeyS') || K.has('ArrowDown')) y -= 1;
    if (K.has('KeyA') || K.has('ArrowLeft')) x -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) x += 1;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    this.move.x = this.enabled ? x : 0;
    this.move.y = this.enabled ? y : 0;
  }

  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = this.look.y = 0;
    return this.enabled ? l : { x: 0, y: 0 };
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.moveH);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('mousemove', this.mouseLock);
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
