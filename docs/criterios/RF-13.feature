# language: es
Característica: Filtros por año, género y tipo
  El usuario puede filtrar por año, género y tipo (RF-13, ADR-0017, ADR-0024).

  @CA-RF13-01
  Escenario: Filtrar por año, género y tipo
    Dado que estoy en el catálogo
    Cuando elijo el año 2023, el género "Fantasía" y el tipo "Serie de TV"
    Entonces solo veo los animes de 2023 de ese género y ese tipo, los más populares primero
