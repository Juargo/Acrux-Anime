# language: es
Característica: Inicio de sesión con Google
  El usuario inicia sesión con su cuenta de Google (RF-01, ADR-0015, DD-19).

  @CA-RF01-01
  Escenario: Iniciar sesión con Google
    Dado que no inicié sesión
    Cuando toco "Continuar con Google" y autorizo con mi cuenta de Google
    Entonces entro a la app con mi nombre y mi contador

  @CA-RF01-02
  Escenario: Google no se abre
    Dado que no inicié sesión
    Y Google no responde
    Cuando toco "Continuar con Google"
    Entonces veo un mensaje que indica que no se pudo abrir Google
    Y sigo sin sesión
