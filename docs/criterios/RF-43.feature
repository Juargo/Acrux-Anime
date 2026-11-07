# language: es
Característica: Sin búsqueda de perfiles
  No existe búsqueda ni listado de perfiles de otros usuarios (RF-43).

  @CA-RF43-01
  Escenario: Solo se llega a un perfil con su enlace
    Dado que la lista de Camila es pública
    Cuando busco "Camila" en la app
    Entonces no aparece ningún perfil
    Y la app no tiene ninguna pantalla que liste perfiles de otros usuarios
