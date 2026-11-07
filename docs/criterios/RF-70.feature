# language: es
Característica: Español e inglés según el navegador
  La app está en español e inglés y usa el idioma del navegador por defecto (RF-70, ADR-0010).

  @CA-RF70-01
  Escenario: La app usa el idioma del navegador
    Dado que mi navegador está en inglés
    Cuando abro la app por primera vez
    Entonces toda la interfaz se muestra en inglés

  @CA-RF70-02
  Escenario: Un idioma no disponible usa el inglés
    Dado que mi navegador está en un idioma distinto del español y del inglés
    Cuando abro la app por primera vez
    Entonces toda la interfaz se muestra en inglés
