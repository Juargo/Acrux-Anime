# language: es
Característica: Perfil público por enlace
  Cualquiera abre app.acruxanime.com/@handle sin cuenta y ve el perfil, con vista previa en
  redes (RF-40, RF-41).

  @CA-RF40-01
  Escenario: Ver un perfil público sin cuenta
    Dado que la lista de Camila es pública
    Cuando un visitante sin cuenta abre su enlace
    Entonces ve su contador, sus vistos y lo que está viendo ahora
