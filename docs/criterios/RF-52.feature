# language: es
Característica: Temas de tarjeta con Plus
  Plus desbloquea temas extra de tarjeta. Antes de pagar, el usuario prueba el tema en su
  propia tarjeta con marca de agua (RF-52, Figma M20/D20). Clásica es gratis y Neón es de
  Plus; Manga espera su diseño.

  @CA-RF52-01
  Escenario: Un usuario Plus elige el tema Neón
    Dado que tengo Plus
    Cuando elijo el tema Neón para mi tarjeta
    Entonces mi tarjeta se muestra con Neón en cualquier dispositivo donde inicie sesión

  @CA-RF52-02
  Escenario: Un usuario gratuito no puede guardar el tema Neón
    Dado que no tengo Plus
    Cuando intento guardar el tema Neón
    Entonces la API lo rechaza con "plan.plus_required" y mi tarjeta sigue en Clásica
