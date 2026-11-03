import { AudioEngine } from './AudioEngine';
/** One audio context for the whole app (iOS allows few). Unlocked by the Start button. */
export const audio = new AudioEngine();
