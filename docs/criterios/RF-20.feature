# language: es
Característica: Marcar una franquicia como vista
  Un clic o toque marca una franquicia como Vista completa: todas las entradas de su
  núcleo, en una sola transacción (RF-20, RDI-31, RNF-11).

  @CA-RF20-01
  Escenario: Marcar una franquicia como vista
    Dado que inicié sesión y mi contador por franquicias está en 12
    Y la franquicia "Shingeki no Kyojin" no está marcada
    Cuando toco "Visto" en la franquicia "Shingeki no Kyojin"
    Entonces el contador muestra 13
    Y todas las entradas del núcleo de la franquicia quedan marcadas como vistas
    Y la franquicia se muestra atenuada en el catálogo

  @CA-RF20-02
  Escenario: La marca no se guarda si la API no responde
    Dado que inicié sesión y mi contador por franquicias está en 12
    Y la API no responde
    Cuando toco "Visto" en la franquicia "Shingeki no Kyojin"
    Entonces veo un mensaje que indica que no se pudo guardar
    Y el contador vuelve a mostrar 12
