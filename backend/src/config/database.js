import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

// Abre SQLite, crea el esquema y ofrece consultas reutilizables para la API.
const dataDirectory = fileURLToPath(new URL("../../../data/", import.meta.url));
const archivo =
  process.env.SQLITE_PATH || resolve(dataDirectory, "red-mascotas.sqlite");
mkdirSync(dirname(archivo), { recursive: true });

export const db = new DatabaseSync(archivo);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  -- Cuentas de usuario y datos de perfil.
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    nombre_publico TEXT NOT NULL DEFAULT '',
    mostrar_nombre_publico INTEGER NOT NULL DEFAULT 0,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    hash_contrasena TEXT NOT NULL,
    sal_contrasena TEXT NOT NULL,
    telefono TEXT NOT NULL DEFAULT '',
    pais TEXT NOT NULL DEFAULT '',
    localidad TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL
  );

  -- Sesiones con token en hash y fecha de vencimiento.
  CREATE TABLE IF NOT EXISTS sesiones (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    vence_en TEXT NOT NULL,
    creado_en TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sesiones_usuario_idx ON sesiones(usuario_id);

  -- Responsables principales y compartidos por mascota.
  CREATE TABLE IF NOT EXISTS responsables_mascota (
    mascota_id TEXT NOT NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('principal', 'cuidador', 'refugio', 'transito')),
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('pendiente', 'activo')),
    creado_en TEXT NOT NULL,
    PRIMARY KEY (mascota_id, usuario_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS responsable_principal_unico
    ON responsables_mascota(mascota_id) WHERE rol = 'principal' AND estado = 'activo';
  CREATE INDEX IF NOT EXISTS responsables_usuario_idx ON responsables_mascota(usuario_id, estado);

  -- Solicitudes de contacto y autorización para compartir datos.
  CREATE TABLE IF NOT EXISTS solicitudes_contacto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mascota_id TEXT NOT NULL,
    solicitante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    destinatario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
    compartir_contacto INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL,
    respondido_en TEXT
  );
  CREATE INDEX IF NOT EXISTS solicitudes_destinatario_idx ON solicitudes_contacto(destinatario_id, estado);
  CREATE INDEX IF NOT EXISTS solicitudes_solicitante_idx ON solicitudes_contacto(solicitante_id, estado);

  -- Lugares de servicio aportados por la comunidad.
  CREATE TABLE IF NOT EXISTS lugares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    direccion TEXT NOT NULL DEFAULT '',
    localidad TEXT NOT NULL,
    provincia TEXT NOT NULL DEFAULT '',
    pais TEXT NOT NULL,
    telefono TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    latitud REAL NOT NULL CHECK (latitud BETWEEN -90 AND 90),
    longitud REAL NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    guardia INTEGER NOT NULL DEFAULT 0,
    verificado INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS lugares_categoria_idx ON lugares(categoria, pais, localidad);
`);

/** Devuelve la fecha actual en formato ISO para persistirla en SQLite. */
export function ahora() {
  return new Date().toISOString();
}

/** Reduce el registro de usuario a los campos que puede recibir su titular. */
export function vistaUsuario(usuario) {
  if (!usuario) return null;
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    nombrePublico: usuario.nombre_publico || null,
    mostrarNombrePublico: Boolean(usuario.mostrar_nombre_publico),
    email: usuario.email,
    telefono: usuario.telefono,
    pais: usuario.pais,
    localidad: usuario.localidad,
    creadoEn: usuario.creado_en,
  };
}

/** Devuelve el nombre de un usuario solo si habilitó su publicación. */
export function usuarioPublico(usuario) {
  if (!usuario || !usuario.mostrar_nombre_publico) return null;
  return { nombre: usuario.nombre_publico || usuario.nombre };
}

/** Lista los responsables activos que aceptaron mostrar su nombre. */
export function responsablesPublicos(mascotaId) {
  return db
    .prepare(
      `
    SELECT u.nombre, u.nombre_publico, r.rol FROM responsables_mascota r
    JOIN usuarios u ON u.id = r.usuario_id
    WHERE r.mascota_id = ? AND r.estado = 'activo' AND u.mostrar_nombre_publico = 1
    ORDER BY CASE r.rol WHEN 'principal' THEN 0 ELSE 1 END, u.nombre_publico
  `,
    )
    .all(mascotaId)
    .map((usuario) => ({
      nombre: usuario.nombre_publico || usuario.nombre,
      rol: usuario.rol,
    }));
}

/** Crea o actualiza el vínculo entre una mascota y una cuenta. */
export function agregarResponsable(
  mascotaId,
  usuarioId,
  rol = "principal",
  estado = "activo",
) {
  db.prepare(
    `
    INSERT INTO responsables_mascota (mascota_id, usuario_id, rol, estado, creado_en)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(mascota_id, usuario_id) DO UPDATE SET rol = excluded.rol, estado = excluded.estado
  `,
  ).run(mascotaId, usuarioId, rol, estado, ahora());
}

/** Busca el responsable principal activo de una mascota. */
export function responsablePrincipal(mascotaId) {
  return db
    .prepare(
      `
    SELECT u.* FROM responsables_mascota r JOIN usuarios u ON u.id = r.usuario_id
    WHERE r.mascota_id = ? AND r.rol = 'principal' AND r.estado = 'activo'
  `,
    )
    .get(mascotaId);
}

/** Comprueba si una cuenta tiene permiso activo para administrar una mascota. */
export function puedeAdministrarMascota(mascotaId, usuarioId) {
  return Boolean(
    db
      .prepare(
        `
    SELECT 1 FROM responsables_mascota
    WHERE mascota_id = ? AND usuario_id = ? AND estado = 'activo'
  `,
      )
      .get(mascotaId, usuarioId),
  );
}

/** Comprueba si la cuenta es el responsable principal activo. */
export function esResponsablePrincipal(mascotaId, usuarioId) {
  return Boolean(
    db
      .prepare(
        `
    SELECT 1 FROM responsables_mascota
    WHERE mascota_id = ? AND usuario_id = ? AND rol = 'principal' AND estado = 'activo'
  `,
      )
      .get(mascotaId, usuarioId),
  );
}
