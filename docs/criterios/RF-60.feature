# language: es
Característica: Tabla de correcciones del agrupamiento
  El curador mantiene una tabla de correcciones del agrupamiento para las ~200 sagas más
  populares, que prevalece sobre el cálculo automático. Una corrección nunca resta al total de
  nadie (RF-60, R-04, RNF-41, DD-03).

  @CA-RF60-01
  Escenario: Una corrección prevalece sobre el cálculo automático
    Dado que el cálculo automático deja una película fuera del núcleo de su saga
    Cuando el curador agrega una corrección que la incluye en el núcleo
    Entonces el detalle de la saga muestra la película en el núcleo

  @CA-RF60-02
  Escenario: Una corrección nunca resta al total
    Dado que vi completa una saga y mi contador muestra 13
    Cuando el curador agrega una corrección que suma una entrada que no vi a su núcleo
    Entonces mi contador sigue mostrando 13
