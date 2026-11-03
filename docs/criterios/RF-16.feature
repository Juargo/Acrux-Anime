# language: es
Característica: Detalle de franquicia
  El detalle muestra las entradas del núcleo, los extras y las franquicias relacionadas, el
  estado de cada entrada y el progreso parcial, y permite marcar desde ahí (RF-16, RF-26).

  @CA-RF16-01
  Escenario: El detalle muestra el progreso parcial y las entradas que faltan
    Dado que vi 3 de las 5 temporadas de una franquicia
    Cuando abro su detalle
    Entonces veo "3/5 temporadas" y cuáles entradas me faltan
