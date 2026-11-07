# language: es
Característica: Tipos de contenido del catálogo
  El catálogo incluye series de TV, películas, OVAs, ONAs y especiales. Se excluye el
  contenido adulto y las entradas de música (RF-11, ADR-0024, DD-17).

  @CA-RF11-01
  Escenario: El catálogo incluye todos los tipos de anime
    Dado que AniList tiene una serie de TV, una película, una OVA, una ONA y un especial
    Cuando busco esos títulos en el catálogo
    Entonces los encuentro todos

  @CA-RF11-02
  Escenario: El catálogo excluye el contenido adulto y la música
    Dado que AniList tiene un anime adulto y un video musical
    Cuando busco esos títulos en el catálogo
    Entonces no aparece ninguno de los dos
