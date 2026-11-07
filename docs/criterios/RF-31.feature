# language: es
Característica: Compartir o descargar la tarjeta
  La tarjeta se comparte con la hoja del navegador (Web Share API) cuando existe; si no, se
  descarga la imagen (RF-31, ADR-0026, Figma flujo 1).

  @CA-RF31-01
  Escenario: Compartir con la hoja del navegador
    Dado que mi navegador permite compartir archivos
    Cuando toco "Compartir" en la vista previa de mi tarjeta
    Entonces se abre la hoja del navegador con la imagen de la tarjeta

  @CA-RF31-02
  Escenario: Descargar la imagen si el navegador no permite compartir
    Dado que mi navegador no permite compartir archivos
    Cuando abro la vista previa de mi tarjeta
    Entonces veo "Descargar imagen" y al tocarlo se descarga la imagen de la tarjeta
