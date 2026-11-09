# language: es
Característica: Compra de Plus vitalicio
  El usuario compra Plus vitalicio con un pago único en Lemon Squeezy. La API crea el checkout
  con el usuario de la sesión, y un webhook firmado activa Plus una sola vez (RF-50, RF-51,
  ADR-0025, ADR-0036).

  @CA-RF50-01
  Escenario: Plus se compra con un pago único
    Dado que soy un usuario gratuito y Plus está disponible
    Cuando abro Acrux Plus desde Perfil y toco "Comprar Plus"
    Entonces se abre el checkout de Lemon Squeezy que creó la API con mi usuario

  @CA-RF50-02
  Escenario: Sin la configuración de pagos no se cobra nada
    Dado que la facturación está apagada en este entorno
    Cuando abro Perfil
    Entonces no veo la fila de Acrux Plus y la API responde 503 a un intento de compra

  @CA-RF50-03
  Escenario: Un aviso de pago repetido no duplica el plan
    Dado que Lemon Squeezy avisó que pagué Plus
    Cuando el mismo aviso llega otra vez
    Entonces la API responde que ya lo procesó y mi plan no cambia

  @CA-RF50-04
  Escenario: Un aviso sin firma válida no da Plus
    Dado que alguien envía un aviso de pago con una firma inválida
    Cuando la API lo recibe
    Entonces responde 401 y nadie recibe Plus
