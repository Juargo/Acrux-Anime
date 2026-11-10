# language: es
Característica: Anuncios no intrusivos para el usuario gratuito
  El usuario gratuito ve anuncios de Google AdSense que no tapan contenido (RF-58,
  ADR-0038). Van en Inicio, Mi lista, la ficha de franquicia y la pantalla de tarjeta,
  siempre fuera de la tarjeta. Sin la configuración de AdSense no se carga nada.

  @CA-RF58-01
  Escenario: Un usuario gratuito ve un anuncio rotulado
    Dado que no tengo Plus y AdSense está configurado
    Cuando abro Inicio, Mi lista, la ficha de una franquicia o la pantalla de tarjeta
    Entonces veo un espacio rotulado «Publicidad» que no tapa el contenido

  @CA-RF58-02
  Escenario: Elijo por separado analítica y anuncios personalizados
    Dado que AdSense está configurado y no decidí todavía
    Cuando aparece el aviso de privacidad
    Entonces puedo aceptar o rechazar «Analítica» y «Anuncios personalizados» por separado
    Y si no acepto los anuncios personalizados, los anuncios no son personalizados

  @CA-RF58-03
  Escenario: Nunca hay anuncios donde RF-58 los excluye
    Dado que no tengo Plus
    Cuando abro la tarjeta, mi perfil público, el inicio de sesión, Perfil o el borrado de cuenta
    Entonces no hay ningún anuncio, ni dentro de la tarjeta ni en la imagen que comparto
