-- La búsqueda de dramas ignora tildes y marcas de tono (#149): «Chen Qing Ling» encuentra
-- «Chén Qíng Lìng». La carga ya guarda search_text sin ellas; esto reescribe las filas que
-- se cargaron antes. Es la misma clave que arma searchKey en apps/api/src/modules/dramas:
-- solo se quitan las marcas latinas (U+0300 a U+036F), así el kana sonoro y el coreano
-- quedan como estaban. search_text se deriva del título y los alias, que no se tocan.
UPDATE "drama"
SET "search_text" = normalize(
  regexp_replace(normalize(lower("search_text"), NFD), '[\u0300-\u036f]', '', 'g'),
  NFC
)
WHERE "search_text" <> normalize(
  regexp_replace(normalize(lower("search_text"), NFD), '[\u0300-\u036f]', '', 'g'),
  NFC
);
