import { useStore } from 'zustand';
import { createStoryStore, type StoryStore } from './story';
import { chapter01Initial } from '@/data/chapter01/initialState';

/** The single live story store (reset on New Game / Continue). */
export const story = createStoryStore(chapter01Initial());

export function useStory<T>(sel: (s: StoryStore) => T): T {
  return useStore(story, sel);
}
