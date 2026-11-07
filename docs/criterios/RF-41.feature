# language: es
Característica: Contenido del perfil público
  El perfil público muestra el contador, la lista de vistos y la de viendo ahora (RF-41).

  @CA-RF41-01
  Escenario: El perfil público muestra mi contador y mis listas
    Dado que mi lista es pública, mi contador muestra 13 y estoy viendo "Sousou no Frieren"
    Cuando un visitante sin cuenta abre mi enlace
    Entonces ve el total 13, mis franquicias vistas y "Sousou no Frieren" en viendo ahora

  @CA-RF41-02
  Escenario: Al hacer pública la lista, el enlace muestra las listas
    Dado que mi lista es privada y un visitante solo ve mi total en mi enlace
    Cuando cambio la visibilidad de mi lista a "Pública"
    Entonces el visitante ve mis franquicias vistas y lo que estoy viendo ahora al abrir mi enlace
