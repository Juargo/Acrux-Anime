# language: es
Característica: Tarjeta vertical para compartir
  El usuario genera una tarjeta 9:16 con su nombre, su avatar, el resumen de lo que ha visto y
  la portada de un anime y de un drama que elige de su lista, y la comparte con la hoja del navegador o la descarga
  (RF-30, RF-31). Lleva el enlace y el QR a su perfil público (RF-32, #37).

  @CA-RF30-01
  Escenario: Compartir la tarjeta
    Dado que inicié sesión y marqué franquicias
    Cuando entro a "Tarjeta"
    Entonces veo de inmediato una imagen vertical con mi total, mi nombre, mi avatar y lo que estoy viendo
    Y si no estoy viendo nada, muestra la portada de lo primero de mi lista
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
    Entonces su portada aparece en la tarjeta, en la mitad del anime o en la del drama

  @CA-RF30-04
  Escenario: Un anime y un drama
    Dado que ya elegí un anime
    Cuando elijo otro
    Entonces el nuevo reemplaza al anterior en la tarjeta
    Y el drama se elige aparte

  @CA-RF30-05
  Escenario: Resumen de animes y dramas
    Dado que marqué animes y dramas
    Cuando veo mi tarjeta
    Entonces muestra en grande cuántos animes y cuántos dramas estoy viendo
    Y debajo de cada cifra, en una etiqueta, cuántos he visto
    Y si no estoy viendo ninguno de un tipo, su cifra grande es 0 y la etiqueta sigue debajo
    Y si no marqué ningún drama, solo muestra la mitad del anime
