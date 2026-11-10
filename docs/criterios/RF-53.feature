# language: es
Característica: Estadísticas avanzadas con Plus
  Plus desbloquea estadísticas avanzadas (RF-53). Un usuario gratuito ve sus horas y
  episodios; los géneros, las décadas y los formatos quedan detrás de Plus.

  @CA-RF53-01
  Escenario: Un usuario Plus ve todas sus estadísticas
    Dado que tengo Plus y marqué animes como vistos
    Cuando abro Estadísticas desde Perfil
    Entonces veo mis horas, episodios y títulos vistos
    Y veo mis géneros favoritos, las décadas de estreno y los formatos

  @CA-RF53-02
  Escenario: Un usuario gratuito ve un adelanto y el resto bloqueado
    Dado que no tengo Plus y marqué animes como vistos
    Cuando abro Estadísticas desde Perfil
    Entonces veo mis horas, episodios y títulos vistos
    Y los géneros, las décadas y los formatos aparecen bloqueados con «Ver Acrux Plus»
