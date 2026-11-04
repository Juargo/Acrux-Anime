# language: es
Característica: Tarjeta vertical para compartir
  El usuario genera una tarjeta 9:16 con su total, nombre, avatar y portadas de lo que está
  viendo ahora, y la comparte con la hoja del navegador o la descarga (RF-30, RF-31). El QR al
  perfil público y la invitación a hacer pública la lista (@CA-RF30-02) llegan con #37.

  @CA-RF30-01
  Escenario: Compartir la tarjeta
    Dado que inicié sesión y marqué franquicias
    Cuando toco "Compartir tarjeta"
    Entonces se genera una imagen vertical con mi total, mi nombre, mi avatar y lo que estoy viendo
    Y puedo enviarla a otra app o guardarla en la galería
