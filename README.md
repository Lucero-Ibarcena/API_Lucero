# Huellas

Red de registro y búsqueda de mascotas con una API y una interfaz web. La primera versión permite crear cuentas, registrar perfiles privados, publicar avisos de pérdida, buscar adopciones, compartir responsabilidades y consultar servicios para animales.

## Empezar

Necesitas Node.js 22.5 o posterior. La aplicación utiliza SQLite incluido en Node y no requiere instalar un servidor de base de datos.

```bash
npm install
npm start
```

Abre <http://localhost:3000>. La ruta `/` muestra la interfaz; `/ayuda` explica la API y `/estado` indica si el servidor está disponible. La interfaz y la API salen del mismo servidor, por eso no hace falta configurar CORS. Las pantallas también tienen enlaces directos bajo `/app/` y se pueden recargar sin perder la vista.

| Pantalla | URL |
|---|---|
| Inicio | `/app/inicio` |
| Buscar mascotas | `/app/buscar` |
| Avisos de pérdida | `/app/avisos` |
| Adopciones | `/app/adopcion` |
| Servicios | `/app/servicios` |
| Mis mascotas | `/app/mascotas` |
| Ficha pública de una mascota | `/app/mascotas/:id` |
| Cuenta y mensajes | `/app/cuenta` |
| Publicar aviso | `/app/publicar` |

Los filtros de búsqueda quedan en la URL, por ejemplo `/app/buscar?q=Luna&localidad=Palermo`. La app consulta la API del mismo servidor (`/mascotas`, `/lugares`, `/usuarios` y `/contacto`); las rutas `/app/...` sirven únicamente las pantallas web.

## Recorrido rápido

1. Pulsa **Crear cuenta** y registra tu usuario. La contraseña requiere al menos 12 caracteres.
2. En **Mis mascotas**, guarda un perfil. Puedes dejarlo privado o publicarlo para que aparezca en búsquedas.
3. Desde el perfil puedes editar los datos, avisar si se perdió, buscarle un hogar o invitar a otra cuenta a compartir el cuidado.
4. En **Mascotas perdidas** y **En adopción**, busca por nombre, especie y localidad. Puedes enviar un mensaje a la persona responsable desde la app.
5. En **Mapa de servicios**, filtra o agrega veterinarias, guardias, refugios y otros puntos. Los aportes nuevos aparecen como no verificados.
6. En **Mi cuenta**, revisa los mensajes. Email y teléfono se comparten solo si la persona responsable acepta y autoriza esa solicitud.

## Estructura

```text
src/
  app.js                    Express, archivos estáticos y rutas API
  server.js                 Inicio del servidor
  config/                   SQLite y colección documental
  middleware/               Autenticación y sesiones
  modules/
    users/                  Cuentas y perfil
    pets/                   Mascotas, estados y responsables
    contact/                Solicitudes de contacto y permisos
    places/                 Servicios del mapa
public/
  index.html                Interfaz web
  css/styles.css            Estilos adaptables a móvil y escritorio
  js/                       Llamadas a la API y vistas
data/                       Bases locales (ignoradas por Git)
legacy/                     Archivos anteriores conservados como referencia
```

## Datos

- **SQLite** en `data/red-mascotas.sqlite`: cuentas, sesiones, relaciones de responsables, solicitudes y lugares.
- **Colección documental JSON** en `data/mascotas-documentos.json`: perfiles flexibles de mascotas.

En desarrollo ambos almacenes corren en un solo servidor local. La colección JSON facilita probar perfiles de distintas especies sin fijar un esquema rígido; para escalar a varios servidores se podrá sustituir por un servicio documental como MongoDB.

Los datos de ejemplo anteriores están conservados en `legacy/mascotas.json`, pero no se importan automáticamente: aquellas cuentas no tienen contraseñas verificadas. Para usar esta versión, crea una cuenta nueva y vuelve a registrar las mascotas necesarias.

## Rutas API

| Método | Ruta | Uso |
|---|---|---|
| POST | `/usuarios` | Crear cuenta e iniciar sesión |
| POST | `/usuarios/login` | Iniciar sesión |
| GET/PATCH | `/usuarios/me` | Consultar o editar el perfil propio |
| POST | `/usuarios/logout` | Cerrar sesión |
| GET | `/mascotas` | Buscar perfiles publicados |
| GET | `/mascotas/propias` | Listar perfiles propios y compartidos |
| POST | `/mascotas` | Registrar una mascota |
| PUT | `/mascotas/:id` | Editar perfil |
| PATCH | `/mascotas/:id/estado` | Cambiar estado |
| POST | `/mascotas/:id/reportes/perdida` | Publicar aviso de pérdida |
| POST | `/mascotas/:id/responsables` | Invitar a compartir el cuidado |
| POST/GET | `/contacto/solicitudes` | Enviar o revisar solicitudes |
| GET/POST | `/lugares` | Buscar o agregar lugares |

Las rutas privadas requieren el token de sesión en `Authorization: Bearer <token>`. La guía `/ayuda` tiene ejemplos completos para enviar solicitudes desde Postman.

## Alcance de esta vista previa

La interfaz ya permite registrar cuentas y perfiles, buscar mascotas, reportar una pérdida, cambiar un perfil a adopción, compartir responsabilidades, escribir a responsables con permiso y agregar puntos al mapa. El mapa incluido es ilustrativo y posiciona los servicios con sus coordenadas; no carga mapas ni geocodificación de terceros. Eventos, colectas, carga de imágenes y verificación por email quedan para una siguiente etapa.
