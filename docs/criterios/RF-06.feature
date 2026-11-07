# language: es
Característica: Borrar la cuenta
  El usuario puede borrar su cuenta y todos sus datos. Si la sesión tiene más de 24 horas,
  debe volver a iniciar sesión antes. Si tiene Plus, se le avisa que el plan vitalicio se pierde
  sin reembolso (RF-06, ADR-0025, ADR-0036, DD-30, DD-33).

  @CA-RF06-01
  Escenario: Borrar mi cuenta y todos mis datos
    Dado que inicié sesión hace menos de 24 horas, marqué franquicias y mi lista es pública
    Cuando toco "Borrar mi cuenta para siempre" y lo confirmo
    Entonces se borran mi perfil, mis marcas y mi enlace con AniList, y los datos de otros usuarios no cambian
    Y vuelvo a la pantalla de inicio de sesión
    Y mi enlace público ya no muestra mi perfil

  @CA-RF06-02
  Escenario: Volver a iniciar sesión si la sesión tiene más de 24 horas
    Dado que inicié sesión hace más de 24 horas
    Cuando abro "Borrar mi cuenta"
    Entonces la app me pide volver a iniciar sesión antes de borrarla
    Y mi cuenta no se borra

  @CA-RF06-03
  Escenario: Aviso de pérdida del plan Plus
    Dado que tengo el plan Plus
    Cuando abro "Borrar mi cuenta"
    Entonces veo un aviso de que el plan vitalicio se pierde sin reembolso
