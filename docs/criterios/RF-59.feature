# language: es
Característica: Plus quita los anuncios
  Plus quita todos los anuncios en cualquier navegador o dispositivo donde el usuario
  inicie sesión (RF-59). Con Plus ni siquiera se carga el script de AdSense (ADR-0038).

  @CA-RF59-01
  Escenario: Un usuario Plus no ve anuncios
    Dado que tengo Plus
    Cuando abro cualquier pantalla de la app en cualquier dispositivo
    Entonces no veo anuncios y la app no carga AdSense
