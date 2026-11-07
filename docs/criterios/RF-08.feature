# language: es
Característica: Descargar mis datos
  El usuario puede descargar sus datos personales en JSON en cualquier momento (RF-08,
  ADR-0028, Ley 21.719).

  @CA-RF08-01
  Escenario: Descargar mis datos en JSON
    Dado que inicié sesión y marqué franquicias
    Cuando toco "Descargar mis datos" en mi perfil
    Entonces se descarga un archivo JSON con mi perfil y mis marcas

  @CA-RF08-02
  Escenario: La descarga falla
    Dado que inicié sesión
    Y la API no responde
    Cuando toco "Descargar mis datos"
    Entonces veo un mensaje que indica que no se pudieron descargar mis datos
