# language: es
Característica: Contador total
  Un contador total visible arriba se actualiza al marcar o desmarcar, desde la primera marca
  (RF-24).

  @CA-RF24-01
  Escenario: El contador aparece con la primera marca
    Dado que inicié sesión y nunca marqué nada
    Cuando marco una franquicia como vista
    Entonces el contador arriba muestra 1

  @CA-RF24-02
  Escenario: El contador baja al desmarcar
    Dado que mi contador muestra 2
    Cuando quito una franquicia de vistas
    Entonces el contador muestra 1 sin recargar la app
