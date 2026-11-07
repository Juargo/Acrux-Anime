# language: es
Característica: Tarjeta básica gratuita y sin anuncios
  La tarjeta básica es gratuita y nunca lleva anuncios (RF-33, RN-05).

  @CA-RF33-01
  Escenario: Compartir la tarjeta básica sin pagar y sin anuncios
    Dado que inicié sesión sin el plan Plus
    Cuando genero y comparto mi tarjeta
    Entonces no se me pide pagar
    Y ni la vista previa ni la imagen de la tarjeta llevan anuncios
