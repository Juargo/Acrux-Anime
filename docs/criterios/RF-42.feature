# language: es
Característica: Lista privada por defecto
  Con la lista privada, el enlace muestra solo el resumen del perfil (Figma M15); el criterio
  original («igual a la de un enlace inexistente») se cambió por decisión del 2026-11-04 (#37).

  @CA-RF42-01
  Escenario: Un perfil privado solo muestra su total
    Dado que la lista de Camila es privada
    Cuando un visitante abre su enlace
    Entonces ve su nombre, su avatar, su handle y su total, y "Camila mantiene su lista privada"
    Y no ve nada de su lista
