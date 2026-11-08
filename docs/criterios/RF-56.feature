# language: es
Característica: Plus no vence y un reembolso no borra nada
  Plus vitalicio no vence. Si se reembolsa la compra, el usuario vuelve a ser gratuito y
  conserva su lista, su total y sus tarjetas (RF-56, ADR-0036).

  @CA-RF56-01
  Escenario: Un reembolso total devuelve el plan gratuito y conserva la lista
    Dado que compré Plus y marqué animes como vistos
    Cuando Lemon Squeezy avisa que la compra se reembolsó por completo
    Entonces mi plan vuelve a ser gratuito y mi lista sigue igual

  @CA-RF56-02
  Escenario: Un reembolso parcial mantiene Plus
    Dado que compré Plus
    Cuando Lemon Squeezy avisa un reembolso parcial de esa compra
    Entonces sigo teniendo Plus
