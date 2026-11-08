import { useSettings } from '@/smena/state/settings';

export type Action = 'interact' | 'flashlight' | 'use' | 'inventory' | 'pause' | 'crouch' | 'journal' | `slot${number}`;
export interface JoyState { active: boolean; ox: number; oy: number; x: number; y: number }

/**
 * Unified input.
 * Touch: floating joystick in the left zone, swipe-look anywhere else that is not a
 * button (buttons stop propagation, so they never start a look gesture). Pushing the
 * joystick past its rim starts sprinting; the sprint button toggles it as well.
 * Desktop: WASD/arrows, Shift sprint, C/Ctrl crouch, E interact, F flashlight,
 * LMB/R use, Tab/I inventory, J journal, Esc pause, 1–8 select slot. Mouse-look via pointer lock.
 */
export class Input {
  move = { x: 0, y: 0 };
  sprint = false;
  joy: JoyState = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  enabled = true;
  usingTouch = false;
  sprintToggle = false;
  onJoy?: (j: JoyState) => void;
  onAction?: (a: Action) => void;
  private look = { x: 0, y: 0 };
  private joyId: number | null = null;
  private lookId: number | null = null;
  private lastLook = { x: 0, y: 0 };
  private keys = new Set<string>();
  private readonly radius = 58;
  private joyPush = 0;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.moveH, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.reset);
    document.addEventListener('mousemove', this.mouseLock);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private joyZone(x: number) {
    const left = !useSettings.getState().leftHanded;
    const w = window.innerWidth;
    return left ? x < w * 0.42 : x > w * 0.58;
  }

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') this.usingTouch = true;
    if (!this.enabled) return;
    if (e.pointerType !== 'mouse' && this.joyZone(e.clientX) && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joy = { active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.onJoy?.(this.joy);
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lastLook = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'mouse') {
        if (!document.pointerLockElement && !this.usingTouch) this.el.requestPointerLock?.()?.catch?.(() => {});
        else if (e.button === 0) this.onAction?.('use');
        else if (e.button === 2) this.onAction?.('interact');
      }
    }
    e.preventDefault();
  };

  private moveH = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      this.joyPush = d / this.radius;
      if (d > this.radius * 1.35) {
        // floating base follows the finger, so the stick never "runs out"
        const k = (d - this.radius * 1.35) / d;
        this.joy.ox += dx * k;
        this.joy.oy += dy * k;
        dx = e.clientX - this.joy.ox;
        dy = e.clientY - this.joy.oy;
      }
      this.joy.x = Math.max(-1, Math.min(1, dx / this.radius));
      this.joy.y = Math.max(-1, Math.min(1, dy / this.radius));
      this.onJoy?.(this.joy);
      e.preventDefault();
    } else if (e.pointerId === this.lookId && !document.pointerLockElement) {
      const s = useSettings.getState();
      const k = 0.0046 * s.lookSensitivity;
      this.look.x += (e.clientX - this.lastLook.x) * k;
      this.look.y += (e.clientY - this.lastLook.y) * k * (s.invertY ? -1 : 1);
      this.lastLook = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  private mouseLock = (e: MouseEvent) => {
    if (!document.pointerLockElement || !this.enabled) return;
    const s = useSettings.getState();
    const k = 0.0021 * s.lookSensitivity;
    this.look.x += e.movementX * k;
    this.look.y += e.movementY * k * (s.invertY ? -1 : 1);
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.joyPush = 0;
      this.joy = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
      this.onJoy?.(this.joy);
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  };

  private keyDown = (e: KeyboardEvent) => {
    if (e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Escape') return this.onAction?.('pause');
    if (e.code === 'KeyE' || e.code === 'Enter') this.onAction?.('interact');
    if (!this.enabled) return;
    if (e.code === 'KeyF') this.onAction?.('flashlight');
    if (e.code === 'KeyR') this.onAction?.('use');
    if (e.code === 'Tab' || e.code === 'KeyI') this.onAction?.('inventory');
    if (e.code === 'KeyJ') this.onAction?.('journal');
    if (e.code === 'KeyC' || e.code === 'ControlLeft') this.onAction?.('crouch');
    const m = /^Digit([1-8])$/.exec(e.code);
    if (m) this.onAction?.(`slot${Number(m[1]) - 1}`);
  };
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  /** UI buttons call this. */
  press(a: Action) {
    if (!this.enabled && a !== 'pause' && a !== 'interact') return;
    this.onAction?.(a);
  }

  reset = () => {
    this.keys.clear();
    this.joyId = this.lookId = null;
    this.joyPush = 0;
    this.joy = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.onJoy?.(this.joy);
    this.look.x = this.look.y = 0;
  };

  update() {
    let x = 0, y = 0;
    if (this.joy.active) {
      x = this.joy.x;
      y = -this.joy.y;
      const m = Math.hypot(x, y);
      if (m < 0.14) x = y = 0;
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
    const keySprint = K.has('ShiftLeft') || K.has('ShiftRight');
    this.sprint = this.enabled && this.move.y > 0.3 && (keySprint || this.sprintToggle || this.joyPush > 1.3);
    if (this.sprintToggle && Math.hypot(this.move.x, this.move.y) < 0.1) this.sprintToggle = false;
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
