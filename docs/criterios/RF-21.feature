# language: es
Característica: Viendo ahora y viendo de nuevo
  El usuario marca una franquicia como Viendo ahora. Volver a ver una saga Vista la muestra
  como "Viendo de nuevo" y sigue sumando (RF-21, DD-15).

  @CA-RF21-01
  Escenario: Marcar una franquicia como viendo ahora
    Dado que inicié sesión y la franquicia "Sousou no Frieren" no está marcada
    Cuando la marco como "Viendo"
    Entonces aparece en mi lista "Viendo ahora"
    Y la marca se mantiene al recargar la app

  @CA-RF21-02
  Escenario: Volver a ver una saga vista
    Dado que vi completa la franquicia "Shingeki no Kyojin" y mi contador muestra 13
    Cuando la marco como "Viendo"
    Entonces se muestra como "Viendo de nuevo"
    Y el contador sigue mostrando 13
