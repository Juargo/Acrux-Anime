# language: es
# Pendiente: P-08, la pantalla "Acerca de" no tiene diseño en Figma.
Característica: Pantalla Acerca de
  Una pantalla "Acerca de" atribuye el catálogo a MyAnimeList, con un enlace (RF-74, ADR-0043).

  @CA-RF74-01
  Escenario: Ver la atribución a MyAnimeList
    Dado que estoy en mi perfil
    Cuando abro "Acerca de"
    Entonces veo que los datos del catálogo los provee MyAnimeList
    Y veo un enlace a MyAnimeList
