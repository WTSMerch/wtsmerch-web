# API MariaDB (rama de desarrollo)
No desplegar en producción hasta validar conexión y contrato de datos.
Archivos: api/db.php y api/catalogo-mariadb.php.
Configuración requerida en el servidor (NO en GitHub):
WTS_DB_HOST, WTS_DB_NAME, WTS_DB_USER, WTS_DB_PASSWORD.
Rotar la contraseña previamente compartida antes de configurar el servidor.
El endpoint GET /api/catalogo-mariadb.php devuelve productos publicados y disponibles, paginados; no realiza escrituras.
No sustituye aún /api/catalogo.php ni modifica data/config.json, app.js o el sistema Apps Script.
Pendiente: verificar la disponibilidad de variables de entorno en LatinCloud, comprobar columnas reales del esquema y probar respuesta antes de integrar la tienda.
