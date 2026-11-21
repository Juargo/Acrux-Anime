# language: es
Característica: Tarjeta vertical para compartir
  El usuario genera una tarjeta 9:16 con su nombre, su avatar, el resumen de lo que ha visto y
  las portadas que elige de su lista, y la comparte con la hoja del navegador o la descarga
  (RF-30, RF-31). Lleva el enlace y el QR a su perfil público (RF-32, #37).

  @CA-RF30-01
  Escenario: Compartir la tarjeta
    Dado que inicié sesión y marqué franquicias
    Cuando entro a "Tarjeta"
    Entonces veo de inmediato una imagen vertical con mi total, mi nombre, mi avatar y lo que estoy viendo
    Y puedo enviarla a otra app o guardarla en la galería

  @CA-RF30-02
  Escenario: Invitación a hacer pública la lista al compartir por primera vez
    Dado que mi lista es privada y nunca compartí una tarjeta
    Cuando comparto mi primera tarjeta
    Entonces la app me ofrece hacer pública mi lista para que el QR muestre mi perfil

  @CA-RF30-03
  Escenario: Elegir qué series muestra la tarjeta
    Dado que tengo animes y dramas en mi lista, vistos o en Viendo
    Cuando elijo uno debajo de la tarjeta
    Entonces su portada aparece en la tarjeta, bajo "ANIME" o bajo "DRAMAS"

  @CA-RF30-04
  Escenario: Máximo de dos animes y dos dramas
    Dado que ya elegí dos animes
    Cuando intento elegir un tercero
    Entonces no puedo hasta quitar uno
    Y el límite de dos dramas es aparte

  @CA-RF30-05
  Escenario: Resumen de animes y dramas
    Dado que marqué animes y dramas
    Cuando veo mi tarjeta
    Entonces muestra cuántos animes y cuántos dramas he visto
    Y si no marqué ningún drama, solo muestra el total de animes
