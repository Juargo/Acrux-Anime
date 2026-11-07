# language: es
# Pendiente: P-08, la pantalla "Acerca de" no tiene diseño en Figma.
Característica: Pantalla Acerca de
  Una pantalla "Acerca de" atribuye el catálogo a AniList (RF-74, ADR-0024).

  @CA-RF74-01
  Escenario: Ver la atribución a AniList
    Dado que estoy en mi perfil
    Cuando abro "Acerca de"
    Entonces veo que los datos del catálogo los provee AniList
