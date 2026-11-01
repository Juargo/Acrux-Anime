# Runbook: respaldos de producción

El flujo `Backup` (`.github/workflows/backup.yml`) corre cada lunes a las 08:00 UTC: `pg_dump` de la rama `production` de Neon, cifrado con `age` y subida a un bucket privado de Cloudflare R2. Los respaldos se conservan 30 días (ADR-0032). Nunca se guardan como artefacto de Actions, porque el repositorio es público.

La clave privada de `age` no está en el repositorio ni en Actions. Sin ella ningún respaldo se puede leer, así que perderla equivale a perder todos los respaldos.

## Configuración inicial

Se hace una sola vez, y otra vez al rotar una clave.

1. **Bucket:** en Cloudflare, R2 → *Create bucket*, con el nombre `acrux-respaldos` y sin acceso público. En *Settings* → *Object lifecycle rules*, agregar una regla que borre los objetos a los 30 días.
2. **Token de R2:** R2 → *Manage API tokens* → *Create API token*, con *Object Read & Write* limitado a `acrux-respaldos`. Copiar el Access Key ID, el Secret Access Key y el endpoint `https://<cuenta>.r2.cloudflarestorage.com`.
3. **Claves de `age`:** ejecutar `age-keygen`. La línea `# public key: age1...` es la clave pública. El archivo completo es la clave privada: va al gestor de contraseñas, no se guarda en el repositorio ni en una carpeta sincronizada.
4. **Rol `acrux_backup`:** en el SQL Editor de Neon, sobre la rama `production`, con el rol propietario y una clave nueva generada con `openssl rand -base64 32`:

   ```sql
   ALTER ROLE acrux_backup WITH LOGIN PASSWORD '<secreto>';
   ```

5. **Entorno de GitHub `backup-production`:** sin revisores y limitado a la rama `main`. En Neon, *Connect* sobre `production`, con el pooling desactivado, muestra el host directo.

   ```sh
   gh secret set DATABASE_URL_BACKUP --env backup-production
   # postgresql://acrux_backup:<secreto>@<host-directo>/<base>?sslmode=require
   gh secret set R2_ACCESS_KEY_ID --env backup-production
   gh secret set R2_SECRET_ACCESS_KEY --env backup-production
   gh variable set AGE_RECIPIENT --env backup-production --body 'age1...'
   gh variable set R2_BUCKET --env backup-production --body 'acrux-respaldos'
   gh variable set R2_ENDPOINT --env backup-production --body 'https://<cuenta>.r2.cloudflarestorage.com'
   ```

## Comprobar el último respaldo

```sh
gh run list --workflow backup.yml --limit 3
```

Un fallo avisa por el correo normal de GitHub Actions. Para forzar un respaldo: `gh workflow run backup.yml`. GitHub desactiva los flujos programados tras 60 días sin actividad en el repositorio; si eso pasa, se reactiva con `gh workflow enable backup.yml`.

## Restaurar

Se restaura siempre en una **rama temporal de Neon**, nunca directamente sobre `production` ni sobre `dev`. Hace falta `age`, el AWS CLI y un cliente de PostgreSQL 18.

1. Descargar el respaldo, con las credenciales de R2 en `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`:

   ```sh
   export AWS_DEFAULT_REGION=auto AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
   aws s3 ls s3://acrux-respaldos/ --endpoint-url "$R2_ENDPOINT"
   aws s3 cp s3://acrux-respaldos/<objeto> respaldo.dump.age --endpoint-url "$R2_ENDPOINT"
   ```

2. En Neon, crear una rama desde `dev`, por ejemplo `restauracion-<fecha>`, con vencimiento. Como ya trae las tablas, crear en ella una base vacía con `CREATE DATABASE restauracion;` y tomar la cadena directa de esa base con el rol propietario.
3. Descifrar y restaurar sin escribir los datos en disco:

   ```sh
   age --decrypt --identity <clave-privada> respaldo.dump.age \
     | pg_restore --no-owner --no-privileges --dbname "$URL_RAMA_TEMPORAL"
   ```

4. Verificar que los conteos coincidan con la rama de origen y que las migraciones estén al día:

   ```sql
   SELECT count(*) FROM profile;
   SELECT count(*) FROM mark;
   SELECT count(*) FROM _prisma_migrations;
   ```

5. Borrar la rama temporal y `respaldo.dump.age`.

Una restauración real sobre `production` es una decisión aparte: se apaga el despliegue, se decide la ventana de pérdida con los datos de la última semana y se registra lo ocurrido.

## Pruebas de restauración

| Fecha | Respaldo | Resultado |
|---|---|---|
