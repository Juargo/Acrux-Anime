# language: es
Característica: Un solo ítem por franquicia
  Cada anime aparece como un solo ítem por franquicia que agrupa sus temporadas, películas y
  demás entradas (RF-14).

  @CA-RF14-01
  Escenario: Las temporadas y las películas forman un solo ítem
    Dado que una saga tiene tres temporadas y una película en MyAnimeList
    Cuando la busco en el catálogo
    Entonces veo un solo ítem para la saga
    Y al abrirlo veo sus tres temporadas y su película
