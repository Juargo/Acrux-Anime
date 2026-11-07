# language: es
Característica: Búsqueda por nombre
  El usuario puede buscar por nombre (RF-12, ADR-0017).

  @CA-RF12-01
  Escenario: Buscar un anime por su nombre
    Dado que "Sousou no Frieren" tiene dos temporadas en AniList
    Cuando escribo "frieren" en el buscador
    Entonces veo un solo ítem para la franquicia, con su portada y su título
