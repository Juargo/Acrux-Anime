# language: es
Característica: Nombre visible y avatar
  El usuario cambia el nombre y el avatar que muestran su tarjeta y su perfil público: la foto
  de Google o uno de Acrux, sin subir archivos en la beta (RF-07, Figma M06).

  @CA-RF07-01
  Escenario: Cambiar mi nombre visible
    Dado que inicié sesión
    Cuando cambio mi nombre visible a "Cami"
    Entonces mi tarjeta y mi perfil público muestran "Cami"
