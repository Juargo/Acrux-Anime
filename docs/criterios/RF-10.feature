# language: es
Característica: Catálogo de anime
  La app muestra el catálogo de anime con portada y título; en el primer uso, una carga en
  ráfaga de las sagas más populares de AniList (RF-10, DD-09).

  @CA-RF10-01
  Escenario: El primer uso muestra las sagas más populares
    Dado que abro la app por primera vez
    Cuando se carga el catálogo
    Entonces veo las sagas más populares de AniList, cada una con su portada y su título
