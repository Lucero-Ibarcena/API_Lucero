# Plan para ordenar el proyecto

## 1. Situacion actual

El proyecto esta haciendo una migracion desde una estructura plana hacia una separacion entre backend y frontend:

- `backend/` contiene el servidor, la configuracion, la autenticacion y las rutas API.
- `frontend/` contiene las paginas HTML y hojas de estilo.
- `public/` conserva JavaScript que antes formaba parte del frontend publico.
- `data/` contiene SQLite y el archivo documental.
- `legacy/` contiene una version anterior que debe conservarse solo como referencia.
- `routes/busquedaRouters.js` es un archivo incompleto y no se usa en el servidor actual.

La reorganizacion todavia no esta terminada:

- `package.json` tiene `main` y `start` apuntando a `src/server.js`, pero el servidor real esta en `backend/src/server.js`.
- El servidor se encuentra en `backend/src/app.js` y espera archivos en `public/`, pero la pagina HTML principal esta en `frontend/index.html`.
- `frontend/src/` esta vacia mientras el JavaScript esta en `public/js/`.
- Los registros de Git indican que algunas carpetas antiguas fueron eliminadas y sus reemplazos estan sin confirmar.

No se deben borrar archivos antes de verificar que todo lo nuevo ya funciona.

## 2. Objetivo de estructura

Conviene llegar a esta organizacion:

```text
API_Lucero/
├── backend/
│   ├── config/
│   │   ├── database.js
│   │   └── documentos.js
│   ├── middleware/
│   │   └── auth.js
│   ├── modules/
│   │   ├── contact/routes.js
│   │   ├── pets/routes.js
│   │   ├── places/routes.js
│   │   └── users/routes.js
│   └── src/
│       ├── app.js
│       └── server.js
├── frontend/
│   ├── index.html
│   ├── ayuda.html
│   ├── css/
│   │   ├── styles.css
│   │   └── reference-layout.css
│   └── js/
│       ├── api.js
│       ├── app.js
│       ├── icons.js
│       └── ui.js
├── data/
├── legacy/
├── postman/
├── index.js
├── package.json
├── package-lock.json
└── README.md
```

## 3. Orden recomendado

### Paso 1: corregir el arranque

En `package.json`, reemplazar las referencias al servidor antiguo:

```json
"main": "src/server.js",
"scripts": {
  "start": "node src/server.js"
}
```

por las rutas actuales:

```json
"main": "backend/src/server.js",
"scripts": {
  "start": "node backend/src/server.js"
}
```

El script `test` existente no es una prueba funcional; por ahora no debe usarse para validar el arranque. Cuando se corrija este paso, iniciar la aplicacion con:

```bash
npm start
```

El servidor debe indicar que esta disponible en `http://localhost:3000`. Si aparece un error de version, revisar que se este usando Node 22.5 o posterior.

### Paso 2: unir frontend y servidor

En `backend/src/app.js`, hacer que las rutas apunten desde `backend/src/` a la carpeta `frontend/` ubicada en la raiz del proyecto. Reemplazar:

```js
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
const helpPage = fileURLToPath(new URL('../public/ayuda.html', import.meta.url));
```

por:

```js
const publicDirectory = fileURLToPath(new URL('../../frontend/', import.meta.url));
const helpPage = fileURLToPath(new URL('../../frontend/ayuda.html', import.meta.url));
```

Y cambiar la ruta que carga la aplicacion para `/app/...`:

```js
app.get(/^\/app(?:\/.*)?$/, (_req, res) =>
  res.sendFile(fileURLToPath(new URL('../../frontend/index.html', import.meta.url)))
);
```

`express.static(publicDirectory)` debe mantenerse. Al servir `frontend/` como raiz publica, las referencias existentes `/css/...` y `/js/...` del HTML funcionan sin cambiarse, siempre que esos archivos esten en `frontend/css/` y `frontend/js/`.

### Paso 3: mover el JavaScript

Confirmar que estos archivos esten en `frontend/js/`:

- `api.js`
- `app.js`
- `icons.js`
- `ui.js`

Si alguno todavia esta en `public/js/`, moverlo a `frontend/js/`. Verificar que los imports relativos entre modulos sigan funcionando. No borrar archivos de `public/` hasta comprobar que ya no se usan y que las rutas nuevas cargan correctamente.

### Paso 4: eliminar carpetas duplicadas

Solo despues de comprobar el arranque y las pantallas, retirar:

- `public/` si ya no contiene archivos usados.
- `frontend/src/` si sigue vacia.
- `routes/busquedaRouters.js` si no se integra ni se usa.
- `index.js` solo si se confirma que no es un punto de entrada necesario.

No eliminar `legacy/`: contiene versiones anteriores utiles para comparar.

### Paso 5: corregir la documentacion

Reemplazar o actualizar `README.md` con informacion real:

- Version de Node requerida.
- Carpeta que inicia el servidor.
- Comando `npm install`.
- Comando `npm start`.
- URL del servidor.
- Ubicaciones reales de backend, frontend y data.
- Rutas API disponibles.
- Uso de SQLite y JSON documental.
- Variables de entorno, si se agregan.

### Paso 6: crear la prueba minima

Aunque no haya un framework de pruebas, agregar al menos un script verificable:

1. El servidor inicia sin errores.
2. `GET /estado` responde con JSON.
3. `GET /` carga la interfaz.
4. `GET /ayuda` carga la guia.
5. `POST /usuarios` crea una cuenta de prueba.
6. `POST /usuarios/login` inicia sesion.
7. `GET /usuarios/me` acepta el token obtenido.

Mientras no exista una suite automatizada, estos pasos pueden documentarse primero y luego convertirse en pruebas automatizadas con Node.

## 4. Que debe quedar fuera de Git

Mantener en `.gitignore`:

- `node_modules/`
- `.env`
- `data/*.sqlite`
- `data/*.sqlite-*`
- `data/mascotas-documentos.json`
- `*.log`

No agregar datos reales de usuarios ni contrasenas a la base ni al repositorio.

## 5. Compatibilidad del servidor

El proyecto usa Node 22.5 o posterior porque usa `node:sqlite`. Antes de probar API o interfaz, confirmar la version:

```bash
node --version
```

## 6. Secuencia segura de Git

Antes de hacer cambios mayores:

```bash
git --no-pager status
git --no-pager diff
```

Conservar los cambios existentes y confirmar despues de cada etapa. Una propuesta de commits es:

1. Corregir el script de arranque.
2. Conectar correctamente el backend con el frontend.
3. Mover el JavaScript sin duplicados.
4. Limpiar carpetas antiguas despues de verificar.
5. Actualizar el README y agregar pruebas basicas.
