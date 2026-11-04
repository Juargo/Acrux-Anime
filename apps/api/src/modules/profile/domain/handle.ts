// The @handle of the public link (#37): generated once from the display name, unique.
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
const FALLBACK = 'usuario';
const PATTERN = /^[a-z0-9_]{3,20}$/;

// Route names of the app and the API, and the brand, never become someone's handle.
const RESERVED = new Set([
  'acrux',
  'acruxanime',
  'admin',
  'api',
  'app',
  'ayuda',
  'explorar',
  'franquicia',
  'help',
  'login',
  'me',
  'mi_lista',
  'milista',
  'perfil',
  'privacidad',
  'root',
  'soporte',
  'support',
  'tarjeta',
]);

export const isHandle = (value: string) => PATTERN.test(value);

// Latin letters that NFKD does not split into a base letter and a mark.
const SPELLED: Record<string, string> = {
  æ: 'ae',
  đ: 'd',
  ð: 'd',
  ħ: 'h',
  ı: 'i',
  ł: 'l',
  ø: 'o',
  œ: 'oe',
  ß: 'ss',
  þ: 'th',
};

// "José Ñúñez" → "josenunez": no accents, only a-z, 0-9 and _, at most 20 characters.
export function handleBase(displayName: string): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[æđðħıłøœßþ]/g, (letter) => SPELLED[letter] ?? '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, HANDLE_MAX);
  return base.length < HANDLE_MIN || RESERVED.has(base) ? FALLBACK : base;
}

// The base, then the base with 2, 3, … appended, cut so that each fits in 20 characters.
export function handleCandidates(base: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return base;
    const suffix = String(index + 1);
    return base.slice(0, HANDLE_MAX - suffix.length) + suffix;
  });
}

// When the numbered candidates run out (a common name, or "usuario" for names without
// Latin letters): the base with six random digits, cut so that it fits in 20 characters.
export function randomCandidate(base: string, random: () => number = Math.random): string {
  const digits = String(Math.floor(random() * 1_000_000)).padStart(6, '0');
  return base.slice(0, HANDLE_MAX - digits.length) + digits;
}
