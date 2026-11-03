# language: es
Característica: Agrupamiento de franquicias
  Las secuelas y precuelas forman el núcleo; las historias paralelas y los resúmenes son
  extras; los spin-offs y los remakes son franquicias aparte, enlazadas como relacionadas
  (RF-15, RDI-30).

  @CA-RF15-01
  Escenario: Las secuelas forman el núcleo y los spin-offs van aparte
    Dado una saga con dos temporadas, una película secuela y un spin-off
    Cuando se calcula su franquicia
    Entonces el núcleo contiene las dos temporadas y la película
    Y el spin-off es una franquicia aparte marcada como relacionada
