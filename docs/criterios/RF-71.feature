# language: es
Característica: Cambiar el idioma
  El usuario puede cambiar el idioma (RF-71, #43).

  @CA-RF71-01
  Escenario: Cambiar el idioma
    Dado que la app está en español
    Cuando elijo inglés en mi perfil
    Entonces toda la interfaz se muestra en inglés y la preferencia se mantiene
