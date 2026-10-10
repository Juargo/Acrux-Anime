# ADR-0007: Autenticación con Google y Apple, y borrado de cuenta

- **Estado:** Aceptado
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (D3, R7), Reunión 002 (D7), Reunión 004 (implicaciones para iOS)

## Contexto

Se requieren cuentas para vincular y guardar la lista de cada persona (D3). En iOS, si se ofrece login con un proveedor externo como Google, Apple suele exigir también «Sign in with Apple» (R7). Además, Apple y Google exigen que el usuario pueda borrar su cuenta, y Apple pide que se pueda hacer desde la app (Reunión 004, a verificar contra las guías vigentes).

## Opciones consideradas

| Opción | Comentario |
|---|---|
| Correo y contraseña | Hay que gestionar recuperación de contraseña y verificación de correo; más fricción. |
| Solo Google | Rechazo probable en App Store por no ofrecer Sign in with Apple. |
| **Google y Apple** | Cubre a la mayoría de los usuarios en ambas plataformas y cumple el requisito de Apple. |

## Decisión

- Login **solo con Google y Apple** (D7), mediante Supabase Auth (ADR-0006).
- **Borrado de cuenta dentro de la app**, implementado antes del envío a App Store. Borra el usuario de Supabase Auth y todas sus marcas.

## Consecuencias

- **Positivas:** sin contraseñas que gestionar; cumple los requisitos de las tiendas.
- **Negativas / riesgos:** configuración en tres consolas (Google Cloud, Apple Developer y Supabase); cada una con credenciales distintas para Android, iOS y web.
- **Acciones derivadas:**
  - Configurar OAuth en Google Cloud y Apple Developer y registrar los proveedores en Supabase (Sprint 0).
  - Implementar el borrado de cuenta como Edge Function (requiere privilegios de administrador; ver ADR-0004).
  - Describir el borrado de cuenta en la landing (ADR-0012); Google Play pide además una URL donde solicitarlo.
  - El nombre de usuario y el avatar para la imagen de compartir (ADR-0009) se obtienen del perfil del proveedor. Falta definir qué se muestra cuando Apple oculta el correo o no entrega el nombre.

## Preguntas abiertas

- ¿Se permite editar el nombre de usuario y el avatar dentro de la app, o se usan los del proveedor?
