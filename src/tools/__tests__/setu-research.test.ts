import { describe, expect, test } from 'bun:test';
import { normalizeOpenQuestions, splitResearchContent } from '../setu-research';

describe('setu_research chunking', () => {
  test('splits large content into fixed-size chunks', () => {
    const input = 'a'.repeat(95);
    const chunks = splitResearchContent(input, 40);

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(40);
    expect(chunks[1].length).toBe(40);
    expect(chunks[2].length).toBe(15);
  });

  test('chunks reassemble to original content', () => {
    const input = 'The quick brown fox jumps over the lazy dog. ';
    const chunks = splitResearchContent(input, 10);
    expect(chunks.join('')).toBe(input);
  });

  test('throws for invalid chunk size', () => {
    expect(() => splitResearchContent('abc', 0)).toThrow('chunkSize must be positive');
    expect(() => splitResearchContent('abc', -1)).toThrow('chunkSize must be positive');
  });
});

describe('setu_research open question normalization', () => {
  test('treats sentinel values as no open questions', () => {
    expect(normalizeOpenQuestions('None')).toBeUndefined();
    expect(normalizeOpenQuestions('N/A')).toBeUndefined();
    expect(normalizeOpenQuestions('no open questions')).toBeUndefined();
    expect(normalizeOpenQuestions('- none')).toBeUndefined();
  });

  test('preserves meaningful open question content', () => {
    const normalized = normalizeOpenQuestions('Should this be txt or md?');
    expect(normalized).toBe('Should this be txt or md?');
  });
});
