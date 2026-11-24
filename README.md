# Huellas

Aplicación web y API para registrar, buscar y cuidar mascotas en comunidad. El servidor Express entrega la interfaz y la API desde el mismo origen.

## Requisitos e inicio

- Node.js 22.5 o posterior (usa `node:sqlite`).
- npm.

```bash
npm install
npm start
```

Abre <http://localhost:3000>. Puedes cambiar el puerto con la variable de entorno `PORT` y la ubicación de SQLite con `SQLITE_PATH`.

## Estructura

```text
backend/
  src/
    app.js                 Configura Express, la interfaz y los errores HTTP
    server.js              Inicia el servidor
    index/api.js           Registra los módulos y prefijos de la API
    config/
      database.js          Esquema SQLite y consultas compartidas
      documentos.js        Lectura y escritura de perfiles JSON
    middleware/
      auth.js              Validación de sesiones y permisos
    modules/
      users/routes.js      Registro, sesión y perfil de usuario
      pets/routes.js       Perfiles, búsqueda y estados de mascotas
      contact/routes.js    Solicitudes y permisos para compartir contacto
      places/routes.js     Servicios y puntos del mapa
frontend/
  src/
    index.html             Entrada de la aplicación web
    ayuda.html             Guía de la API
    css/
      styles.css           Variables, colores y componentes visuales
      layout.css           Distribución y adaptación de pantallas
    js/
      app.js               Navegación, vistas, formularios y acciones
      api.js               Solicitudes HTTP y sesión local
      ui.js                Tarjetas y elementos reutilizables
      icons.js             Catálogo de iconos SVG
data/                      Almacenes locales (ignorados por Git)
legacy/                    Código y datos de la primera versión, solo referencia
postman/                   Ajustes del espacio de trabajo de Postman
index.js                   Entrada del paquete para importar la aplicación Express
```

`backend/src/index/api.js` es el índice central de rutas: para sumar un área nueva, se crea su módulo bajo `backend/src/modules/` y se registra allí. La interfaz se sirve directamente desde `frontend/src/`, sin un proceso de compilación.

## Pantallas

| Pantalla          | URL                 |
| ----------------- | ------------------- |
| Inicio            | `/app/inicio`       |
| Buscar mascotas   | `/app/buscar`       |
| Avisos de pérdida | `/app/avisos`       |
| Adopciones        | `/app/adopcion`     |
| Servicios         | `/app/servicios`    |
| Mis mascotas      | `/app/mascotas`     |
| Ficha pública     | `/app/mascotas/:id` |
| Cuenta y mensajes | `/app/cuenta`       |
| Publicar aviso    | `/app/publicar`     |
| Sobre Huellas     | `/app/sobre`        |

Las rutas `/app/...` cargan la misma aplicación y conservan la pantalla al abrir o recargar un enlace. Los filtros se pueden compartir en la URL, por ejemplo `/app/buscar?q=Luna&localidad=Palermo`.

## Datos

- `data/red-mascotas.sqlite`: usuarios, sesiones, responsables, solicitudes de contacto y lugares.
- `data/mascotas-documentos.json`: perfiles flexibles de mascotas; se crea al guardar el primer perfil.
- `legacy/mascotas.json`: datos de muestra de la primera versión; no se importan automáticamente.

La base de datos y los perfiles locales se excluyen de Git. SQLite funciona con el módulo incluido en Node; no hace falta instalar un servidor de base de datos.

## API

La guía completa con ejemplos está en <http://localhost:3000/ayuda>. Las rutas principales son:

| Método           | Ruta                    | Uso                                                |
| ---------------- | ----------------------- | -------------------------------------------------- |
| GET              | `/estado`               | Estado del servidor                                |
| POST             | `/usuarios`             | Crear una cuenta e iniciar sesión                  |
| POST             | `/usuarios/login`       | Iniciar sesión                                     |
| GET/PATCH/DELETE | `/usuarios/me`          | Consultar, editar o eliminar la cuenta              |
| PATCH            | `/usuarios/me/contrasena` | Cambiar la contraseña                              |
| POST             | `/usuarios/logout`      | Cerrar sesión                                      |
| GET/POST         | `/mascotas`             | Buscar perfiles publicados o registrar una mascota |
| GET              | `/mascotas/propias`     | Listar perfiles propios y compartidos              |
| PUT              | `/mascotas/:id`         | Editar un perfil                                     |
| PATCH            | `/mascotas/:id/estado`  | Cambiar el estado                                    |
| DELETE           | `/mascotas/:id`         | Eliminar un perfil                                   |
| POST/GET/DELETE  | `/contacto/solicitudes` | Enviar, consultar o cancelar solicitudes pendientes |
| GET/POST         | `/lugares`              | Consultar o agregar servicios                      |
| GET/PUT/DELETE   | `/lugares/:id`          | Consultar, editar o eliminar un servicio propio     |

Las rutas privadas requieren `Authorization: Bearer <token>`. Los perfiles públicos no exponen datos privados como coordenadas exactas, teléfono, email ni información médica restringida.
