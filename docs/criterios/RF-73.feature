# language: es
Característica: Ajustes sin botón Guardar
  Los ajustes se guardan al instante, sin botón "Guardar", y se confirman con un mensaje breve
  (RF-73, Figma flujo 4, M16/D16).

  @CA-RF73-01
  Escenario: Un ajuste se guarda al cambiarlo
    Dado que inicié sesión y mi lista es privada
    Cuando cambio la visibilidad de mi lista a "Pública"
    Entonces veo el mensaje "Listo, guardado."
    Y la pantalla no tiene botón "Guardar"
    Y el cambio se mantiene al recargar la app
