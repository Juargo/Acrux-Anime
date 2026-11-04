# language: es
Característica: Mi lista de vistos y de viendo ahora
  El usuario ve las franquicias que está viendo y las que vio, con su portada y con estado
  vacío; «Vistas» muestra lo que cuenta el contador (RF-27, RNF-42).

  @CA-RF27-01
  Escenario: Ver mi lista de viendo ahora
    Dado que marqué 2 franquicias como "viendo ahora"
    Cuando abro "Viendo ahora"
    Entonces veo esas 2 franquicias con su portada
