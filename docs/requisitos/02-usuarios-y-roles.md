# Usuarios, roles y permisos

## Roles

La identidad es la cuenta de Google (Supabase Auth). AniList es un vínculo opcional, no un medio de inicio de sesión (ADR-0025). Esto reemplaza la nota de Obsidian que hacía depender el rol de usuario de un inicio de sesión con AniList.

| Rol | Quién es | Cómo accede |
|---|---|---|
| **Visitante** | Alguien que abre un perfil público o una tarjeta compartida | Sin cuenta, por enlace o QR |
| **Usuario gratuito** | Fan con cuenta en Acrux | Google (OAuth con PKCE) |
| **Usuario Plus** | Usuario gratuito con plan anual o vitalicio vigente | Google + compra en Lemon Squeezy |
| **Curador** | El autor o colaboradores de confianza | Claim `app_metadata.role = 'curator'`, asignado solo desde Supabase |

No hay rol de moderador: no hay reseñas ni foros.

## Matriz de permisos

| Permiso | Visitante | Gratuito | Plus | Curador | Mecanismo (ADR-0025) |
|---|---|---|---|---|---|
| Ver un perfil público | ✅ | ✅ | ✅ | ✅ | Ruta pública + lista pública |
| Explorar el catálogo y ver franquicias | ❌ | ✅ | ✅ | ✅ | Usuario autenticado |
| Marcar franquicias y entradas | ❌ | ✅ | ✅ | ✅ | Filtro por `user_id` del JWT |
| Contador y progreso parcial | ❌ | ✅ | ✅ | ✅ | Filtro por `user_id` |
| Tarjeta básica | ❌ | ✅ | ✅ | ✅ | Usuario autenticado |
| Hacer pública o privada su lista | ❌ | ✅ | ✅ | ✅ | Filtro por `user_id` |
| Reportar una saga mal armada | ❌ | ✅ | ✅ | ✅ | Usuario autenticado |
| Temas y plantillas Plus | ❌ | Vista previa con marca de agua | ✅ | ✅ | `requirePlan('plus')` |
| Estadísticas avanzadas y Wrapped | ❌ | ❌ | ✅ | ✅ | `requirePlan('plus')` |
| Insignias e íconos | ❌ | ❌ | ✅ | ✅ | `requirePlan('plus')` |
| Editar la tabla de correcciones y atender reportes | ❌ | ❌ | ❌ | ✅ | `requireRole('curator')` |
| Ver métricas agregadas | ❌ | ❌ | ❌ | ✅ | `requireRole('curator')` |

Se retira de la matriz "separar o unir franquicias solo para su cuenta": estaba fuera de alcance en los requisitos funcionales y Figma lo reemplaza por el reporte al curador.

## Reglas

- Lo esencial es gratis para siempre, incluida la tarjeta básica.
- El plan y el rol se deciden siempre en el servidor; nunca se toman del cliente ni del JWT (el plan).
- El visitante nunca ve datos que el usuario no haya hecho públicos. Si la lista es privada, la API responde `404`.
- No hay búsqueda ni listado de perfiles de otros usuarios.
- El curador nunca ve datos personales de quien reporta.

## Personas

| | **Camila** (B) | **Diego** (A) | **Javier** (C) | **Marcela** (D) |
|---|---|---|---|---|
| Arquetipo | Otaku que comparte | Fan casual | Usuario de MAL o AniList cansado | Completista |
| Edad | 22 | 18 | 27 | 31 |
| Ubicación | Santiago, Chile | Ciudad de México | Buenos Aires | Bogotá o España |
| Dispositivos | Celular (principal) + laptop | Celular casi exclusivo | Celular + PC | PC + celular |
| Qué quiere | Mostrar su contador en Stories y TikTok | Saber qué vio y qué le falta | Menos desorden, sincronizado con AniList | Episodios y estadísticas finas |
| Qué le frustra | Que su total se vea inflado o feo al compartir | Apps con demasiadas opciones | Entradas duplicadas por temporada | Que le quiten control |
| Disposición a pagar | Media (cosméticos) | Baja | Media | Alta, pero ya está atendida |

Ubicación, nivel técnico, entorno y dispositivos son hipótesis a validar en las entrevistas. Detalle completo en la nota de Obsidian *Acrux - Usuarios, Roles y Personas*.
