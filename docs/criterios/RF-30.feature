# language: es
Característica: Tarjeta vertical para compartir
  El usuario genera una tarjeta 9:16 con su total, nombre, avatar y portadas de lo que está
  viendo ahora, y la comparte con la hoja del navegador o la descarga (RF-30, RF-31). Lleva el
  enlace y el QR a su perfil público (RF-32, #37).

  @CA-RF30-01
  Escenario: Compartir la tarjeta
    Dado que inicié sesión y marqué franquicias
    Cuando toco "Compartir tarjeta"
    Entonces se genera una imagen vertical con mi total, mi nombre, mi avatar y lo que estoy viendo
    Y puedo enviarla a otra app o guardarla en la galería

  @CA-RF30-02
  Escenario: Invitación a hacer pública la lista al compartir por primera vez
    Dado que mi lista es privada y nunca compartí una tarjeta
    Cuando comparto mi primera tarjeta
    Entonces la app me ofrece hacer pública mi lista para que el QR muestre mi perfil
