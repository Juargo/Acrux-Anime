# language: es
Característica: Estados del pago y plan en Perfil
  La app informa la confirmación, el error al iniciar el pago y el pago pendiente, y muestra
  el plan en Perfil (RF-57; Figma M21–M24 adaptadas al pago único de ADR-0036).

  @CA-RF57-01
  Escenario: Confirmación al volver del pago
    Dado que pagué Plus en Lemon Squeezy
    Cuando vuelvo a Acrux y el aviso de pago llega
    Entonces veo "¡Ya eres Plus!"

  @CA-RF57-02
  Escenario: Error al iniciar el pago
    Dado que Lemon Squeezy no pudo crear el checkout
    Cuando toco "Comprar Plus"
    Entonces veo que no se pudo iniciar el pago y que no se me cobró nada

  @CA-RF57-03
  Escenario: Pago pendiente
    Dado que volví de Lemon Squeezy
    Cuando el aviso de pago no llega en un minuto
    Entonces veo que mi pago se está confirmando

  @CA-RF57-04
  Escenario: El plan se ve en Perfil
    Dado que compré Plus
    Cuando abro Perfil
    Entonces la fila Acrux Plus dice "Activo" y su pantalla dice "Plus vitalicio"
