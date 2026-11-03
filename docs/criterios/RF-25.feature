# language: es
Característica: Contador total por franquicias o por entradas
  El contador fijo arriba cuenta por franquicia por defecto; un interruptor junto a él permite
  contar por entradas, y la preferencia se guarda en el perfil (RF-24, RF-25, RDI-32).

  @CA-RF25-01
  Escenario: Cambiar a conteo por entradas
    Dado que vi una franquicia completa de 4 entradas y mi contador muestra 1
    Cuando cambio el interruptor a "por entradas"
    Entonces el contador muestra 4
    Y la preferencia se mantiene al volver a entrar
