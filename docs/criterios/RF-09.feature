# language: es
# Pendiente: P-07, el requisito de edad es una propuesta que ningún ADR define todavía.
Característica: Declaración de edad
  Antes de crear la cuenta, el usuario declara tener 16 años o más (RF-09, Figma M01/D01).

  @CA-RF09-01
  Escenario: Declarar la edad antes de crear la cuenta
    Dado que no tengo cuenta
    Cuando abro la pantalla de inicio de sesión
    Entonces debo declarar que tengo 16 años o más antes de crear la cuenta
