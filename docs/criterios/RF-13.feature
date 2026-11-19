# language: es
Característica: Filtros por año, género y tipo
  El usuario puede filtrar por año de estreno de la franquicia, género y tipo
  (RF-13, ADR-0017, ADR-0024, ADR-0045).

  @CA-RF13-01
  Escenario: Filtrar por año, género y tipo
    Dado que estoy en el catálogo
    Cuando elijo el año 2023, el género "Fantasía" y el tipo "Serie de TV"
    Entonces solo veo las franquicias estrenadas en 2023 con alguna entrada de ese género y ese tipo, las más populares primero
