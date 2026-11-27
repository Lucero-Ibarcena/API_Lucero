# Anotaciones del proyecto: CRUD con Postman

Esta guía explica cómo enviar solicitudes a la API de Huellas desde Postman. Los ejemplos usan principalmente **servicios** para probar el ciclo CRUD completo.

## Qué significa CRUD

- **Create (crear):** `POST`
- **Read (consultar o buscar):** `GET`
- **Update (editar):** `PUT` o `PATCH`
- **Delete (borrar):** `DELETE`

La API no usa un prefijo `/api`. Por ejemplo, la ruta de servicios es `/lugares`, no `/api/lugares`.

## Iniciar el proyecto

Abre una terminal en la carpeta principal del proyecto y ejecuta:

```bash
npm start
```

El servidor queda disponible en `http://localhost:3000`. Déjalo abierto mientras usas Postman. Comprueba la conexión con:

```text
GET http://localhost:3000/estado
```

La respuesta esperada es `200 OK`.

## Preparar Postman

Puedes crear un entorno con estas variables:

| Variable | Valor inicial | Para qué sirve |
| --- | --- | --- |
| `baseUrl` | `http://localhost:3000` | Dirección local del servidor |
| `token` | vacío | Sesión de la cuenta |
| `idLugar` | vacío | Identificador del servicio de prueba |

En las solicitudes con cuerpo, elige **Cuerpo → sin procesar → JSON**. Postman debe enviar el encabezado `Content-Type: application/json`.

## Iniciar sesión y obtener el token

Crear, editar o borrar servicios requiere una cuenta autenticada. Si todavía no tienes una cuenta de prueba, crea una:

```text
POST {{baseUrl}}/usuarios
```

```json
{
  "nombre": "Usuario de Postman",
  "email": "usuario.postman@example.com",
  "contrasena": "ClaveTemporal123!",
  "localidad": "CABA",
  "pais": "Argentina"
}
```

La contraseña debe tener al menos 12 caracteres y el email debe ser único. Si el email ya existe, inicia sesión en su lugar:

```text
POST {{baseUrl}}/usuarios/login
```

```json
{
  "email": "usuario.postman@example.com",
  "contrasena": "ClaveTemporal123!"
}
```

En la respuesta, copia `sesion.token` a la variable `token`. En Postman, para las solicitudes protegidas, selecciona **Autorización → Token de portador** y escribe `{{token}}`.

El registro responde `201 Created`; el inicio de sesión responde `200 OK`.

## Probar el CRUD de servicios

Usa un servicio propio de prueba para editarlo y eliminarlo. Los seis servicios iniciales de CABA sirven para consultar el listado y el mapa, pero no pertenecen a tu cuenta y no se pueden editar ni borrar con ella.

### 1. Crear un servicio

```text
POST {{baseUrl}}/lugares
```

Incluye el token y envía este cuerpo:

```json
{
  "nombre": "Lugar de prueba Postman",
  "categoria": "tienda",
  "descripcion": "Registro temporal para comprobar el CRUD",
  "direccion": "Av. de prueba 123",
  "localidad": "CABA",
  "provincia": "Ciudad Autónoma de Buenos Aires",
  "pais": "Argentina",
  "telefono": "",
  "email": "",
  "latitud": -34.6037,
  "longitud": -58.3816,
  "guardia": false
}
```

La respuesta esperada es `201 Created`. Copia el `id` devuelto a la variable `idLugar`.

Las categorías aceptadas son: `veterinaria`, `guardia`, `tienda`, `peluqueria`, `refugio`, `guarderia`, `escuela`, `perrera`, `parque`, `pet_friendly` y `otro`. El nombre, categoría, localidad, país y coordenadas son obligatorios. `guardia` debe ser `true` o `false`.

### 2. Consultar los servicios

El listado es público y no requiere token:

```text
GET {{baseUrl}}/lugares?localidad=CABA
```

Para consultar solo el registro creado:

```text
GET {{baseUrl}}/lugares/{{idLugar}}
```

Ambas respuestas esperadas son `200 OK`. En el listado deben aparecer los servicios iniciales y el servicio de prueba.

### 3. Editar el servicio propio

```text
PUT {{baseUrl}}/lugares/{{idLugar}}
```

Incluye el token. Se pueden enviar solo los campos que quieras cambiar; por ejemplo:

```json
{
  "descripcion": "Descripción modificada desde Postman"
}
```

La respuesta esperada es `200 OK` y debe mostrar la descripción nueva.

### 4. Borrar el servicio propio

```text
DELETE {{baseUrl}}/lugares/{{idLugar}}
```

Incluye el token. La respuesta esperada es `200 OK` con un mensaje de confirmación. Repite el `GET` individual: debería devolver `404 Not Found`.

## Rutas CRUD de otras áreas

Las rutas de escritura requieren token, salvo el registro de cuenta y el inicio de sesión.

| Área | Método y ruta | Operación |
| --- | --- | --- |
| Cuenta | `POST /usuarios` | Crear cuenta e iniciar sesión |
| Cuenta | `POST /usuarios/login` | Iniciar sesión |
| Cuenta | `GET /usuarios/me` | Consultar la cuenta propia |
| Cuenta | `PATCH /usuarios/me` | Editar datos propios |
| Cuenta | `DELETE /usuarios/me` | Borrar la cuenta propia |
| Mascotas | `GET /mascotas` | Buscar perfiles publicados |
| Mascotas | `GET /mascotas/propias` | Consultar perfiles propios y compartidos |
| Mascotas | `POST /mascotas` | Crear un perfil |
| Mascotas | `PUT /mascotas/:id` | Editar un perfil autorizado |
| Mascotas | `DELETE /mascotas/:id` | Borrar un perfil autorizado |
| Servicios | `GET /lugares` o `GET /lugares/:id` | Consultar servicios |
| Servicios | `POST /lugares` | Agregar un servicio |
| Servicios | `PUT /lugares/:id` | Editar un servicio propio |
| Servicios | `DELETE /lugares/:id` | Borrar un servicio propio |

En las rutas que muestran `:id`, reemplaza ese texto por el identificador real. Para `GET /mascotas/propias`, agrega el token; `GET /mascotas` solo muestra perfiles publicados.

**Precaución:** `DELETE /usuarios/me` elimina la cuenta. Para probarlo, utiliza una cuenta descartable, incluye el token y envía la contraseña actual en el cuerpo:

```json
{
  "contrasena": "ClaveTemporal123!"
}
```

## Reseñas de servicios

Las reseñas de Huellas son distintas de las reseñas de Google. Para probarlas, consulta primero un servicio y usa su identificador:

| Método y ruta | Operación | Autenticación |
| --- | --- | --- |
| `GET /lugares/:id/resenas` | Consultar reseñas | No requerida |
| `POST /lugares/:id/resenas` | Crear una reseña propia | Requerida |
| `PUT /lugares/:id/resenas/:resenaId` | Editar la reseña propia | Requerida |
| `DELETE /lugares/:id/resenas/:resenaId` | Borrar la reseña propia | Requerida |

Ejemplo para crear una reseña:

```json
{
  "puntuacion": 5,
  "comentario": "Buena atención y explicaron claramente el tratamiento."
}
```

La puntuación debe ser un número del 1 al 5. Una cuenta puede publicar una reseña por servicio; la respuesta de consulta incluye `miResena.id`, que sirve como `:resenaId` para editar o borrar la propia.

## Respuestas de error habituales

| Código | Qué revisar |
| --- | --- |
| `400` — Solicitud incorrecta | El cuerpo JSON, una categoría, un campo o una coordenada no es válido |
| `401` — No autenticado | Falta el token o venció la sesión |
| `403` — Sin permiso | El registro pertenece a otra cuenta o no tiene creador asignado |
| `404` — No encontrado | El identificador no existe o el registro ya fue borrado |
| `409` — Conflicto | El email ya está registrado o ya existe una reseña propia para ese servicio |

La guía web de la API también está disponible en `http://localhost:3000/ayuda`.
