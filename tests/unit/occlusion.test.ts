import { describe, it, expect } from 'vitest';
import { occlusionBetween, type Edge } from '@/game/audio/occlusion';

let frontOpen = false;
const edges: Edge[] = [
  { a: 'hall', b: 'room', kind: 'door', isOpen: () => true },
  { a: 'hall', b: 'landing', kind: 'frontDoor', isOpen: () => frontOpen },
  { a: 'room', b: 'apt48', kind: 'wall' },
];

describe('sound occlusion graph', () => {
  it('same room is unfiltered', () => {
    expect(occlusionBetween(edges, 'room', 'room')).toEqual({ cutoff: 20000, gain: 1 });
  });
  it('a closed front door muffles the landing', () => {
    frontOpen = false;
    const o = occlusionBetween(edges, 'landing', 'hall');
    expect(o.cutoff).toBeLessThan(1000);
    expect(o.gain).toBeLessThan(0.5);
  });
  it('opening the door lets the sound through', () => {
    frontOpen = true;
    const o = occlusionBetween(edges, 'landing', 'hall');
    expect(o.cutoff).toBeGreaterThan(5000);
  });
  it('through-wall neighbour is darker than next room', () => {
    const wall = occlusionBetween(edges, 'apt48', 'room');
    const door = occlusionBetween(edges, 'hall', 'room');
    expect(wall.cutoff).toBeLessThan(door.cutoff);
  });
  it('multi-hop paths attenuate further', () => {
    frontOpen = false;
    const far = occlusionBetween(edges, 'landing', 'room');
    const near = occlusionBetween(edges, 'landing', 'hall');
    expect(far.gain).toBeLessThan(near.gain);
  });
  it('unknown rooms fall back to heavily muffled', () => {
    expect(occlusionBetween(edges, 'nowhere', 'room').cutoff).toBeLessThan(300);
  });
});
