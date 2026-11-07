# language: es
Característica: Ofrecer hacer pública la lista al compartir por primera vez
  Al compartir la primera tarjeta, se ofrece hacer pública la lista (RF-35, DD-23, ADR-0028,
  Figma M08/D08).

  @CA-RF35-01
  Escenario: Hacer pública la lista desde la oferta
    Dado que mi lista es privada y nunca compartí una tarjeta
    Cuando comparto mi primera tarjeta y acepto "Hacer pública"
    Entonces veo "Listo, tu lista es pública."
    Y mi enlace público muestra mi lista

  @CA-RF35-02
  Escenario: La oferta no se repite
    Dado que ya compartí una tarjeta y mi lista sigue privada
    Cuando comparto otra tarjeta
    Entonces la app no me ofrece hacer pública la lista
