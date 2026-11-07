# language: es
Característica: Desmarcar o cambiar el estado
  El usuario puede desmarcar o cambiar el estado de la franquicia o de cada entrada desde el
  menú de entradas (botón ⋯ en escritorio; toque largo o ⋯ en celular). Si desmarcar resta, el
  aviso lo indica (RF-22, DD-14, DD-16, Figma M10/D10).

  @CA-RF22-01
  Escenario: Desmarcar una franquicia vista resta del total
    Dado que inicié sesión, vi completa la franquicia "Shingeki no Kyojin" y mi contador muestra 48
    Cuando abro su menú de entradas y la quito de vistas
    Entonces veo el aviso "Tu total baja a 47"
    Y el contador muestra 47

  @CA-RF22-02
  Escenario: Cambiar el estado de una sola entrada
    Dado que vi 3 de las 5 temporadas de una franquicia
    Cuando abro su menú de entradas y marco la cuarta temporada como vista
    Entonces la franquicia muestra 4 de 5 entradas vistas
