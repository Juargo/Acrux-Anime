import { describe, expect, it } from 'vitest';
import { searchKey } from './search-key.js';

describe('searchKey', () => {
  it('lowers the case and drops accents and tone marks', () => {
    expect(searchKey('Chén Qíng Lìng')).toBe('chen qing ling');
    expect(searchKey('Crème BRÛLÉE')).toBe('creme brulee');
    expect(searchKey('lǜ')).toBe('lu');
  });

  it('keeps Chinese, Japanese and Korean as they are written', () => {
    expect(searchKey('陈情令')).toBe('陈情令');
    // A voiced kana is one letter, not a kana with an accent.
    expect(searchKey('ガール が')).toBe('ガール が');
    expect(searchKey('한글 드라마')).toBe('한글 드라마');
  });
});
