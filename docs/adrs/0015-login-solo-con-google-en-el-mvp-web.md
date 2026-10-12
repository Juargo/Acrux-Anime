# ADR-0015: Login solo con Google en el MVP web

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-12. Reemplaza la parte de proveedores de login de ADR-0007 durante el MVP web; el borrado de cuenta de ADR-0007 sigue vigente.

## Contexto

ADR-0007 decidió el login con Google y Apple porque App Store suele exigir «Sign in with Apple» cuando una app ofrece login con un proveedor externo (R7). Con el MVP como web app (ADR-0013), esa exigencia no aplica: Apple solo la impone a las apps distribuidas en su tienda.

Sign in with Apple en web, en cambio, agrega trabajo al Sprint 0 (ADR-0014): un *Services ID*, la verificación del dominio y de las URLs de retorno en Apple Developer, y una clave de cliente que caduca cada 6 meses y hay que renovar.

## Opciones consideradas

### Opción A: Google y Apple en el MVP web

- **Ventajas:** los usuarios de iPhone sin cuenta de Google tienen una alternativa; la configuración queda lista para la app iOS futura.
- **Desventajas:** la parte con más fricción del Sprint 0; mantenimiento de una clave que caduca; no es obligatorio en la web.

### Opción B: Solo Google en el MVP web; Apple con la app iOS nativa

- **Ventajas:** un solo proveedor que configurar, probar y mantener; libera tiempo del Sprint 0; Google cubre a la mayoría de los usuarios.
- **Desventajas:** quien no tenga o no quiera usar una cuenta de Google no puede registrarse.

## Decisión

**Opción B.** En el MVP web el login es **solo con Google**, mediante Supabase Auth (ADR-0006). **Sign in with Apple** se incorpora junto con la app iOS nativa, donde App Store lo exige.

Sigue vigente de ADR-0007: login sin contraseñas y **borrado de cuenta dentro de la app**, que también es parte del hito del 28-oct (ADR-0014).

## Consecuencias

- **Positivas:** Sprint 0 más liviano; menos credenciales y secretos que administrar; un solo flujo de login que probar.
- **Negativas / riesgos:** se pierde a los usuarios sin cuenta de Google; cuando llegue Apple, una persona que use ambos proveedores con correos distintos tendría dos cuentas separadas (hay que decidir la vinculación de identidades en esa fase).
- **Acciones derivadas:**
  - Configurar solo el proveedor de Google en Supabase y en Google Cloud para el MVP.
  - El nombre y el avatar de la imagen para compartir (ADR-0009) se toman del perfil de Google.
  - Retomar Sign in with Apple y la vinculación de identidades en la fase nativa de iOS.

## Preguntas abiertas

- ¿Se vincularán las identidades de Google y Apple de una misma persona cuando se sume Apple?
