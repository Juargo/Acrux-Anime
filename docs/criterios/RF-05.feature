# language: es
Característica: Cierre de sesión
  El usuario puede cerrar sesión (RF-05).

  @CA-RF05-01
  Escenario: Cerrar sesión
    Dado que inicié sesión
    Cuando toco "Cerrar sesión" en mi perfil
    Entonces vuelvo a la pantalla de inicio de sesión
    Y al recargar la app sigo sin sesión
