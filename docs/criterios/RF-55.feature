# language: es
Característica: Insignias por hitos y avatares exclusivos con Plus
  Plus desbloquea insignias e íconos (RF-55). Las insignias se ganan por hitos: títulos
  vistos, horas vistas y géneros distintos. Todos ven su progreso y las ganan; con Plus se
  ven en el perfil público y en la tarjeta. Los íconos son avatares exclusivos de Plus
  (ADR-0040).

  @CA-RF55-01
  Escenario: Gano insignias al llegar a un hito
    Dado que marqué animes como vistos
    Cuando abro Insignias desde Perfil
    Entonces veo las insignias que gané y el progreso de las demás

  @CA-RF55-02
  Escenario: Con Plus, otros ven mis insignias
    Dado que gané insignias
    Cuando no tengo Plus
    Entonces mi perfil público y mi tarjeta no las muestran y veo «Ver Acrux Plus»
    Cuando compro Plus
    Entonces mi perfil público y mi tarjeta muestran mis insignias

  @CA-RF55-03
  Escenario: Los avatares exclusivos piden Plus
    Dado que no tengo Plus
    Cuando abro el editor de nombre y avatar
    Entonces los avatares exclusivos aparecen bloqueados con el camino a Plus
    Y la API rechaza elegirlos con 403 «plan.plus_required»
