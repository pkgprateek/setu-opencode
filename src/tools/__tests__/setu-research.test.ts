import { describe, expect, test } from 'bun:test';
import { splitResearchContent } from '../setu-research';

describe('setu_research chunking', () => {
  test('splits large content into fixed-size chunks', () => {
    const input = 'a'.repeat(95);
    const chunks = splitResearchContent(input, 40);

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(40);
    expect(chunks[1].length).toBe(40);
    expect(chunks[2].length).toBe(15);
  });

  test('throws for invalid chunk size', () => {
    expect(() => splitResearchContent('abc', 0)).toThrow('chunkSize must be positive');
  });
});
