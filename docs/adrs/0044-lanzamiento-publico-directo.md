# ADR-0044: Lanzamiento público directo, sin esperar la validación ni la beta

- **Estado:** Aceptado
- **Fecha:** 2026-11-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-10: «Voy a dejar los anuncios para más adelante. Quiero comenzar con el lanzamiento directo de la app.» «Cualquier cobro apagado por ahora» «si» al registro abierto desde el primer día y «si» a que el botón de la landing lleve directo a la app.

**Modifica:** ADR-0031, en lo referido a las condiciones para pasar de H1 a H2 y de H2 a H3. La decisión «solo web» y la metodología de ADR-0031 siguen vigentes.

## Contexto

- ADR-0031 ordenó el avance por hitos con umbral: H1 (validación con entrevistas, encuesta y landing), H2 (beta cerrada con 30 a 50 testers y RN-M1 a RN-M3 medidas), H3 (lanzamiento público) y H4 (monetización).
- El 2026-10-30 el stakeholder ya había decidido construir H2 sin esperar el cierre de H1 (nota de ADR-0031). Desde entonces la app se construyó completa: marcar, contador, tarjeta, perfil público, borrado de cuenta, Plus, estadísticas, insignias y anuncios detrás de un interruptor.
- La condición externa de H3 era la autorización de la fuente de datos. AniList no respondió (#6). MyAnimeList autorizó el uso comercial el 2026-11-06 (ADR-0041) y pasa a ser la fuente con un catálogo propio (ADR-0043).
- El 2026-11-10 el stakeholder decidió lanzar la app al público directamente y dejar los anuncios para más adelante.

## Opciones

### Opción A: mantener los hitos de ADR-0031

- **Ventajas:** cada paso se justifica con datos; la beta mide RN-M1 a RN-M3 con pocos usuarios antes de abrir.
- **Desventajas:** la app ya está construida, así que la validación ya no evita ese gasto; reunir entrevistas, 300 respuestas y testers demora el lanzamiento sin fecha.

### Opción B: lanzamiento público directo

- **Ventajas:** la demanda se mide con el producto real y usuarios reales; no hay trabajo de coordinación de la beta.
- **Desventajas:** los problemas los encuentran usuarios reales, sin la red de una beta cerrada; no hay una medición previa de RN-M1 a RN-M3 ni de la disposición a pagar.

## Decisión

**Opción B.**

1. **El lanzamiento público (H3) no espera los umbrales de H1 ni la beta cerrada de H2.** Los umbrales de validación dejan de ser una condición para avanzar.
2. **Los anuncios quedan para más adelante.** El código de RF-58 y RF-59 sigue en la app, apagado: no se configuran las variables `VITE_ADSENSE_*` (ADR-0038).
3. **Todo cobro queda apagado por ahora.** Plus se lanza sin facturación: no se configuran las variables `LEMON_SQUEEZY_*` en producción, así que `/me` responde `plusAvailable: false` y la app muestra «Acrux Plus llega pronto» (`docs/runbooks/plus.md`). Lemon Squeezy en modo real deja de ser condición del lanzamiento. Antes de prender cualquier cobro, el stakeholder lee el acuerdo de la API de MyAnimeList, que prohíbe generar ingresos sin autorización escrita (RN-08, R-01).
4. **El registro queda abierto a cualquiera desde el primer día.** No hay lista de invitados ni cupo de altas.
5. **La landing lleva directo a la app y la lista de espera queda sin uso.** El botón «Únete a la beta» pasa a ser «Abrir Acrux», con enlace a `app.acruxanime.com` (RF-80). El formulario sale de la landing; el endpoint `/api/waitlist` y la integración con Buttondown (ADR-0033) siguen en el código, sin nada que los llame.
6. **Las métricas RN-M1 a RN-M3 se miden después del lanzamiento**, con los mismos eventos de PostHog (ADR-0030). Sus metas «por definir tras la beta» pasan a definirse con los datos del lanzamiento.
7. **Las condiciones técnicas y legales del lanzamiento no cambian:**
   - la fuente de datos autorizada es MyAnimeList, con crédito y enlace (ADR-0041, ADR-0043). El catálogo propio tiene que estar cargado antes de abrir;
   - paso a Vercel Pro antes de cualquier uso comercial (ADR-0020);
   - revisión de seguridad y pendientes de `docs/deuda-tecnica.md` marcados como previos al lanzamiento.

## Consecuencias

- **Positivas:** el lanzamiento depende solo de trabajo propio y del client ID de MyAnimeList; la validación se hace con uso real.
- **Negativas / riesgos:**
  - Sin beta, un defecto llega a todos los usuarios. Se mitiga con las pruebas E2E, el seguimiento de errores y un despliegue que se puede revertir.
  - Sin encuesta no hay dato previo de disposición a pagar. El precio de Plus (RN-07) queda sin validar.
  - Sin anuncios ni Plus, la app no genera ingresos en el lanzamiento y los costos corren por cuenta del stakeholder.
  - RN-04 y RES-02 («primero se valida la demanda») dejan de describir el plan y se actualizan.
- **Acciones derivadas:**
  - Actualizar RN-04, la tabla de hitos y RES-02 en `docs/requisitos`.
  - Completar la migración a MyAnimeList (ADR-0043) y cargar el catálogo.

## Pendiente de decidir

- **Quienes ya están en la lista de espera:** si se les avisa del lanzamiento y cuándo se borran sus correos. La política de privacidad dice que se borran «al terminar la beta».
- **Privacidad y soporte de la landing:** todavía describen la lista de espera, porque los correos anotados siguen guardados. Se actualizan cuando se decida qué pasa con esos correos. Los términos ya no hablan de la beta.
- **Retiro del código de la lista de espera:** `/api/waitlist`, `src/lib/waitlist.ts` y el evento `waitlist_joined`.
