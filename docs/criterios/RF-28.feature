# language: es
Característica: Deshacer una marca
  Toda marca se puede deshacer durante 5 segundos desde un aviso; si la escritura en AniList
  sigue en cola, se cancela (RF-28, Figma flujo 7, M11/D11).

  @CA-RF28-01
  Escenario: Deshacer una marca desde el aviso
    Dado que mi contador muestra 12
    Cuando marco una franquicia como vista y toco "Deshacer" en el aviso antes de 5 segundos
    Entonces la franquicia vuelve a su estado anterior
    Y el contador muestra 12

  @CA-RF28-02
  Escenario: El aviso desaparece a los 5 segundos
    Dado que marqué una franquicia como vista
    Cuando pasan 5 segundos sin tocar "Deshacer"
    Entonces el aviso desaparece y la marca queda guardada

  # Fuera del alcance del lanzamiento (2026-11-10, ADR-0043, punto 8): no hay vínculo con AniList.
  # Pendiente de decisión del Product Owner: se conserva hasta decidir si se retira.
  @CA-RF28-03
  Escenario: Deshacer cancela la escritura pendiente en AniList
    Dado que vinculé mi cuenta de AniList
    Y la escritura de una marca en AniList sigue en cola
    Cuando toco "Deshacer" en el aviso
    Entonces esa marca no se escribe en AniList
