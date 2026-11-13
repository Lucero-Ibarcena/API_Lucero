# API para registrar mascotas

API sencilla para administrar usuarios (dueños) y sus mascotas. Acepta cualquier especie escrita como texto: perro, gato, ave, reptil u otra.

## Iniciar

En la carpeta del proyecto ejecuta:

```bash
npm install
npm start
```

Luego abre `http://localhost:3000`. La página `/ayuda` explica las rutas con etiquetas y ejemplos. Los datos se guardan en `data/mascotas.json`.

## Etiquetas: Usuarios y dueños

| Método | Ruta | Acción |
|---|---|---|
| GET | `/usuarios` | Listar usuarios; puedes filtrar con `?nombre=Ana`. |
| GET | `/usuarios/1` | Consultar por ID. |
| POST | `/usuarios` | Crear un dueño. Requiere `nombre`. |
| PUT | `/usuarios/1` | Actualizar campos. |
| DELETE | `/usuarios/1` | Eliminar si no tiene mascotas asociadas. |

## Etiquetas: Mascotas

| Método | Ruta | Acción |
|---|---|---|
| GET | `/mascotas` | Listar todas las mascotas. |
| GET | `/mascotas/1` | Consultar por ID. |
| POST | `/mascotas` | Registrar. Requiere `nombre` y `especie`. |
| PUT | `/mascotas/1` | Actualizar campos. |
| DELETE | `/mascotas/1` | Eliminar por ID. |

### Buscar mascotas

Puedes combinar filtros: `nombre`, `especie`, `raza`, `edad`, `sexo`, `color`, `tamano` y `usuarioId`.

```text
GET /mascotas?especie=Perro
GET /mascotas?especie=Ave&color=Verde
```

También se mantienen las rutas de búsqueda anteriores, por ejemplo `/mascotas/especie/Perro`, `/mascotas/raza/Caniche` y `/mascotas/dueño/Ana`.

### Ejemplo para registrar una mascota

1. Crea primero su dueño con `POST /usuarios`:

   ```json
   { "nombre": "Ana Pérez", "email": "ana@example.com" }
   ```

2. Usa el `id` que devuelve esa respuesta al crear la mascota con `POST /mascotas`:

   ```json
   {
     "nombre": "Kiwi",
     "especie": "Ave",
     "raza": "Cotorra",
     "edad": 1,
     "usuarioId": 1
   }
   ```

Envía los ejemplos como JSON desde Postman o Thunder Client. `usuarioId` relaciona una mascota con su dueño.

## Organización del código

- `server.js`: inicia el servidor y conecta las rutas.
- `routes/mascotas.js`: búsquedas y CRUD de mascotas.
- `routes/usuarios.js`: CRUD de usuarios.
- `data/almacen.js`: lectura y guardado del archivo JSON.
- `data/mascotas.json`: datos actuales y ejemplos.
