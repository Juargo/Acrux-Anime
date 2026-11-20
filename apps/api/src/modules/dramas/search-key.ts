// What a name becomes to be searched (ADR-0046, point 5): lower case, without accents or tone
// marks, so «Chen Qing Ling» finds «Chén Qíng Lìng». Only the Latin combining marks go: the
// voiced mark of a kana is part of the letter, and Korean syllables are put back together.
export const searchKey = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
