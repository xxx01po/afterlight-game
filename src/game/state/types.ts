export type FlagValue = boolean | number | string;

export interface PhoneMessage {
  id: string;
  from: 'me' | 'them';
  text: string;
  /** Display time, e.g. "03:17" or "12 мар." */
  time: string;
  status?: 'sent' | 'failed';
}
export interface PhoneThread {
  id: string;
  name: string;
  number: string;
  color: string;
  messages: PhoneMessage[];
  unread: number;
}
export interface CallEntry {
  id: string;
  contact: string;
  dir: 'in' | 'out' | 'missed';
  time: string;
  duration?: string;
}
export interface PhotoEntry {
  id: string;
  title: string;
  date: string;
  /** Key of a procedural painter in phone/photos.ts */
  painter: string;
  strange?: boolean;
}
export interface RecordingLine { t: number; text: string }
export interface RecordingEntry {
  id: string;
  title: string;
  date: string;
  duration: number;
  kind: 'lecture' | 'self';
  transcript: RecordingLine[];
  isNew?: boolean;
}
export interface NoteEntry { id: string; title: string; body: string; date: string }

export interface PhoneData {
  threads: PhoneThread[];
  calls: CallEntry[];
  photos: PhotoEntry[];
  recordings: RecordingEntry[];
  notes: NoteEntry[];
}

/** A world change that is only allowed to happen while the player isn't looking at `pos`. */
export interface PendingChange {
  key: string;
  value: FlagValue;
  pos: [number, number, number];
}

export interface ChoiceRecord { id: string; label: string; clock: string }

export interface CharacterState { relation: number; status: string; met: boolean }

/** Everything that is saved. Pure data — no functions, no three.js objects. */
export interface StoryState {
  saveVersion: number;
  chapter: string;
  /** Story events and dialogue outcomes. */
  flags: Record<string, FlagValue>;
  /** Picked-up items (ids from data/items). */
  inventory: string[];
  /** Pieces of information the player has learned (ids). */
  knowledge: string[];
  characters: Record<string, CharacterState>;
  /** Reality-shift variables: the apartment is rendered as a function of these. */
  world: Record<string, FlagValue>;
  pending: PendingChange[];
  stage: number;
  fired: string[];
  clockMin: number;
  phone: PhoneData;
  player: { x: number; z: number; yaw: number; pitch: number };
  playTime: number;
  choices: ChoiceRecord[];
}
