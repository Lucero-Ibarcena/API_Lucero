import { Router } from "express";
import { ahora, db } from "../../config/database.js";
import {
  autenticacionOpcional,
  autenticacionRequerida,
} from "../../middleware/auth.js";
import { seedInitialPlaces } from "./seed.js";

// Endpoints para consultar, registrar y administrar lugares de servicios.
const router = Router();
seedInitialPlaces();
const CATEGORIAS = new Set([
  "veterinaria",
  "guardia",
  "tienda",
  "peluqueria",
  "refugio",
  "guarderia",
  "escuela",
  "perrera",
  "parque",
  "pet_friendly",
  "otro",
]);

// Convierte el registro de base de datos al formato público de la API.
function vistaLugar(lugar, usuarioId = null) {
  const lat = lugar.latitud;
  const lng = lugar.longitud;
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const resenas = db
    .prepare(
      `SELECT COUNT(*) AS cantidad, COALESCE(AVG(puntuacion), 0) AS promedio
       FROM resenas_lugares WHERE lugar_id = ?`,
    )
    .get(lugar.id);
  const miResena = usuarioId
    ? db
        .prepare(
          `SELECT id, puntuacion, comentario, creado_en, actualizado_en
           FROM resenas_lugares WHERE lugar_id = ? AND usuario_id = ?`,
        )
        .get(lugar.id, usuarioId)
    : null;

  return {
    id: lugar.id,
    nombre: lugar.nombre,
    categoria: lugar.categoria,
    descripcion: lugar.descripcion,
    direccion: lugar.direccion,
    localidad: lugar.localidad,
    provincia: lugar.provincia,
    pais: lugar.pais,
    telefono: lugar.telefono || null,
    email: lugar.email || null,
    ubicacion: { latitud: lat, longitud: lng },
    guardia: Boolean(lugar.guardia),
    verificado: Boolean(lugar.verificado),
    propio: usuarioId !== null && lugar.creador_id === usuarioId,
    resenas: {
      cantidad: resenas.cantidad,
      promedio: Number(Number(resenas.promedio).toFixed(1)),
      miResena: miResena
        ? {
            id: miResena.id,
            puntuacion: miResena.puntuacion,
            comentario: miResena.comentario,
            creadoEn: miResena.creado_en,
            actualizadoEn: miResena.actualizado_en,
          }
        : null,
    },
    // Abre la navegación peatonal en Google Maps, donde puede seguirse el GPS.
    comoLlegarUrl: tieneCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking&dir_action=navigate`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lugar.direccion, lugar.localidad, lugar.pais].filter(Boolean).join(", "))}`,
  };
}

// Convierte un valor recibido del formulario y valida la reseña comunitaria.
function datosResena(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo))
    return { error: "Envía la puntuación y el comentario como un objeto." };
  const puntuacion = Number(cuerpo.puntuacion);
  const comentario = typeof cuerpo.comentario === "string" ? cuerpo.comentario.trim() : "";
  if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5)
    return { error: "La puntuación debe estar entre 1 y 5 estrellas." };
  if (cuerpo.comentario !== undefined && typeof cuerpo.comentario !== "string")
    return { error: "El comentario debe ser texto." };
  if (comentario.length > 1200)
    return { error: "El comentario no puede superar los 1200 caracteres." };
  return { puntuacion, comentario };
}

// Devuelve reseñas públicas, ocultando el nombre cuando la cuenta no lo comparte.
function listarResenas(lugarId) {
  return db
    .prepare(
      `SELECT r.id, r.puntuacion, r.comentario, r.creado_en, r.actualizado_en,
         CASE WHEN u.mostrar_nombre_publico = 1
           THEN COALESCE(NULLIF(u.nombre_publico, ''), u.nombre)
           ELSE 'Usuario de Huellas' END AS autor
       FROM resenas_lugares r JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.lugar_id = ? ORDER BY r.creado_en DESC, r.id DESC LIMIT 50`,
    )
    .all(lugarId)
    .map((resena) => ({
      id: resena.id,
      puntuacion: resena.puntuacion,
      comentario: resena.comentario,
      autor: resena.autor,
      creadoEn: resena.creado_en,
      actualizadoEn: resena.actualizado_en,
    }));
}

// Calcula la distancia entre dos coordenadas en kilómetros (fórmula de Haversine).
function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = (grados) => (grados * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Los puntos nuevos quedan sin verificar hasta que se revisen.

// Lista lugares y aplica filtros de categoría, zona, guardia o distancia.
router.get("/", autenticacionOpcional, (req, res) => {
  const condiciones = [];
  const valores = [];
  for (const campo of ["categoria", "localidad", "provincia", "pais"]) {
    if (req.query[campo] !== undefined) {
      if (typeof req.query[campo] !== "string")
        return res
          .status(400)
          .json({ mensaje: `El filtro ${campo} debe ser texto.` });
      condiciones.push(`${campo} LIKE ? COLLATE NOCASE`);
      valores.push(`%${req.query[campo]}%`);
    }
  }
  if (req.query.guardia !== undefined) {
    if (!["true", "false"].includes(req.query.guardia))
      return res
        .status(400)
        .json({ mensaje: "guardia debe ser true o false." });
    condiciones.push("guardia = ?");
    valores.push(req.query.guardia === "true" ? 1 : 0);
  }
  let lugares = db
    .prepare(
      `SELECT * FROM lugares${condiciones.length ? ` WHERE ${condiciones.join(" AND ")}` : ""} ORDER BY verificado DESC, nombre COLLATE NOCASE`,
    )
    .all(...valores);
  if (
    req.query.latitud !== undefined ||
    req.query.longitud !== undefined ||
    req.query.radioKm !== undefined
  ) {
    const lat = Number(req.query.latitud);
    const lng = Number(req.query.longitud);
    const radio = Number(req.query.radioKm ?? 25);
    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(radio) ||
      radio <= 0 ||
      radio > 500
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            "Para buscar por distancia indica latitud, longitud y radioKm válidos (máximo 500).",
        });
    }
    lugares = lugares.filter(
      (lugar) => distanciaKm(lat, lng, lugar.latitud, lugar.longitud) <= radio,
    );
  }
  res.json(lugares.map((lugar) => vistaLugar(lugar, req.usuario?.id ?? null)));
});

// Devuelve un lugar por identificador con el mismo formato que el listado.
router.get("/:id", autenticacionOpcional, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    return res.status(404).json({ mensaje: "Lugar no encontrado." });
  const lugar = db.prepare("SELECT * FROM lugares WHERE id = ?").get(id);
  if (!lugar) return res.status(404).json({ mensaje: "Lugar no encontrado." });
  res.json(vistaLugar(lugar, req.usuario?.id ?? null));
});

// Lee opiniones de la comunidad sin exponer datos privados de las cuentas.
router.get("/:id/resenas", autenticacionOpcional, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    return res.status(404).json({ mensaje: "Lugar no encontrado." });
  const lugar = db.prepare("SELECT id FROM lugares WHERE id = ?").get(id);
  if (!lugar) return res.status(404).json({ mensaje: "Lugar no encontrado." });
  const resumen = db
    .prepare(
      `SELECT COUNT(*) AS cantidad, COALESCE(AVG(puntuacion), 0) AS promedio
       FROM resenas_lugares WHERE lugar_id = ?`,
    )
    .get(id);
  const miResena = req.usuario
    ? db
        .prepare(
          `SELECT id, puntuacion, comentario, creado_en, actualizado_en
           FROM resenas_lugares WHERE lugar_id = ? AND usuario_id = ?`,
        )
        .get(id, req.usuario.id)
    : null;
  res.json({
    cantidad: resumen.cantidad,
    promedio: Number(Number(resumen.promedio).toFixed(1)),
    resenas: listarResenas(id),
    miResena: miResena
      ? {
          id: miResena.id,
          puntuacion: miResena.puntuacion,
          comentario: miResena.comentario,
          creadoEn: miResena.creado_en,
          actualizadoEn: miResena.actualizado_en,
        }
      : null,
  });
});

// Publica una única reseña por cuenta y servicio.
router.post("/:id/resenas", autenticacionRequerida, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    return res.status(404).json({ mensaje: "Lugar no encontrado." });
  if (!db.prepare("SELECT id FROM lugares WHERE id = ?").get(id))
    return res.status(404).json({ mensaje: "Lugar no encontrado." });
  const datos = datosResena(req.body);
  if (datos.error) return res.status(400).json({ mensaje: datos.error });
  if (
    db
      .prepare("SELECT id FROM resenas_lugares WHERE lugar_id = ? AND usuario_id = ?")
      .get(id, req.usuario.id)
  )
    return res.status(409).json({ mensaje: "Ya publicaste una reseña para este lugar. Puedes editarla." });
  const fecha = ahora();
  let resultado;
  try {
    resultado = db
      .prepare(
        `INSERT INTO resenas_lugares
          (lugar_id, usuario_id, puntuacion, comentario, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, req.usuario.id, datos.puntuacion, datos.comentario, fecha, fecha);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed"))
      return res.status(409).json({ mensaje: "Ya publicaste una reseña para este lugar. Puedes editarla." });
    throw error;
  }
  res.status(201).json({
    id: Number(resultado.lastInsertRowid),
    puntuacion: datos.puntuacion,
    comentario: datos.comentario,
    creadoEn: fecha,
    actualizadoEn: fecha,
  });
});

// Permite actualizar solo la reseña perteneciente a la cuenta autenticada.
router.put("/:id/resenas/:resenaId", autenticacionRequerida, (req, res) => {
  const id = Number(req.params.id);
  const resenaId = Number(req.params.resenaId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(resenaId) || resenaId < 1)
    return res.status(404).json({ mensaje: "Reseña no encontrada." });
  const resena = db
    .prepare("SELECT * FROM resenas_lugares WHERE id = ? AND lugar_id = ?")
    .get(resenaId, id);
  if (!resena) return res.status(404).json({ mensaje: "Reseña no encontrada." });
  if (resena.usuario_id !== req.usuario.id)
    return res.status(403).json({ mensaje: "Solo puedes editar tu propia reseña." });
  const datos = datosResena(req.body);
  if (datos.error) return res.status(400).json({ mensaje: datos.error });
  const actualizadoEn = ahora();
  db.prepare(
    "UPDATE resenas_lugares SET puntuacion = ?, comentario = ?, actualizado_en = ? WHERE id = ?",
  ).run(datos.puntuacion, datos.comentario, actualizadoEn, resenaId);
  res.json({
    id: resenaId,
    puntuacion: datos.puntuacion,
    comentario: datos.comentario,
    creadoEn: resena.creado_en,
    actualizadoEn,
  });
});

// Elimina únicamente la reseña propia para mantener el control de cada aporte.
router.delete("/:id/resenas/:resenaId", autenticacionRequerida, (req, res) => {
  const id = Number(req.params.id);
  const resenaId = Number(req.params.resenaId);
  const resena = db
    .prepare("SELECT * FROM resenas_lugares WHERE id = ? AND lugar_id = ?")
    .get(resenaId, id);
  if (!resena) return res.status(404).json({ mensaje: "Reseña no encontrada." });
  if (resena.usuario_id !== req.usuario.id)
    return res.status(403).json({ mensaje: "Solo puedes eliminar tu propia reseña." });
  db.prepare("DELETE FROM resenas_lugares WHERE id = ?").run(resenaId);
  res.json({ mensaje: "Tu reseña fue eliminada." });
});

// Registra un punto de servicio asociado a la cuenta autenticada.
router.post("/", autenticacionRequerida, (req, res) => {
  const cuerpo = req.body ?? {};
  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre.trim() : "";
  const categoria =
    typeof cuerpo.categoria === "string"
      ? cuerpo.categoria.trim().toLowerCase()
      : "";
  const localidad =
    typeof cuerpo.localidad === "string" ? cuerpo.localidad.trim() : "";
  const pais = typeof cuerpo.pais === "string" ? cuerpo.pais.trim() : "";
  const latitud = Number(cuerpo.latitud);
  const longitud = Number(cuerpo.longitud);
  if (!nombre || !CATEGORIAS.has(categoria) || !localidad || !pais) {
    return res
      .status(400)
      .json({
        mensaje: "Se requieren nombre, categoría válida, localidad y país.",
      });
  }
  for (const campo of [
    "descripcion",
    "direccion",
    "provincia",
    "telefono",
    "email",
  ]) {
    if (cuerpo[campo] !== undefined && typeof cuerpo[campo] !== "string")
      return res.status(400).json({ mensaje: `${campo} debe ser texto.` });
  }
  if (
    !Number.isFinite(latitud) ||
    latitud < -90 ||
    latitud > 90 ||
    !Number.isFinite(longitud) ||
    longitud < -180 ||
    longitud > 180
  ) {
    return res
      .status(400)
      .json({
        mensaje: "Las coordenadas deben incluir latitud y longitud válidas.",
      });
  }
  if (cuerpo.guardia !== undefined && typeof cuerpo.guardia !== "boolean")
    return res
      .status(400)
      .json({ mensaje: "guardia debe ser verdadero o falso." });
  const resultado = db
    .prepare(
      `
    INSERT INTO lugares
      (creador_id, nombre, categoria, descripcion, direccion, localidad, provincia, pais, telefono, email, latitud, longitud, guardia, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      req.usuario.id,
      nombre,
      categoria,
      String(cuerpo.descripcion ?? "").trim(),
      String(cuerpo.direccion ?? "").trim(),
      localidad,
      String(cuerpo.provincia ?? "").trim(),
      pais,
      String(cuerpo.telefono ?? "").trim(),
      String(cuerpo.email ?? "").trim(),
      latitud,
      longitud,
      cuerpo.guardia ? 1 : 0,
      ahora(),
    );
  const lugar = db
    .prepare("SELECT * FROM lugares WHERE id = ?")
    .get(Number(resultado.lastInsertRowid));
  res.status(201).json(vistaLugar(lugar, req.usuario.id));
});

// Actualiza un punto de servicio creado por la cuenta autenticada.
router.put("/:id", autenticacionRequerida, (req, res) => {
  const id = Number(req.params.id);
  const lugar = db.prepare("SELECT * FROM lugares WHERE id = ?").get(id);
  if (!lugar) return res.status(404).json({ mensaje: "Lugar no encontrado." });
  if (lugar.creador_id !== req.usuario.id)
    return res
      .status(403)
      .json({ mensaje: "Solo quien agregó el punto puede editarlo." });
  const cuerpo = req.body;
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo))
    return res
      .status(400)
      .json({ mensaje: "Envía cambios como un objeto JSON." });
  const campos = [
    "nombre",
    "categoria",
    "descripcion",
    "direccion",
    "localidad",
    "provincia",
    "pais",
    "telefono",
    "email",
    "latitud",
    "longitud",
    "guardia",
  ];
  for (const campo of Object.keys(cuerpo)) {
    if (!campos.includes(campo))
      return res
        .status(400)
        .json({ mensaje: `No se puede actualizar el campo "${campo}".` });
  }
  const actualizados = { ...lugar };
  for (const campo of campos) {
    if (cuerpo[campo] === undefined) continue;
    if (["latitud", "longitud"].includes(campo))
      actualizados[campo] = Number(cuerpo[campo]);
    else if (campo === "guardia") {
      if (typeof cuerpo.guardia !== "boolean")
        return res
          .status(400)
          .json({ mensaje: "guardia debe ser verdadero o falso." });
      actualizados.guardia = cuerpo.guardia ? 1 : 0;
    } else {
      if (typeof cuerpo[campo] !== "string")
        return res.status(400).json({ mensaje: `${campo} debe ser texto.` });
      actualizados[campo] =
        campo === "categoria"
          ? cuerpo[campo].trim().toLowerCase()
          : cuerpo[campo].trim();
    }
  }
  if (
    !actualizados.nombre ||
    !actualizados.localidad ||
    !actualizados.pais ||
    !CATEGORIAS.has(actualizados.categoria)
  ) {
    return res
      .status(400)
      .json({
        mensaje:
          "El nombre, localidad, país y categoría deben seguir siendo válidos.",
      });
  }
  if (
    !Number.isFinite(actualizados.latitud) ||
    actualizados.latitud < -90 ||
    actualizados.latitud > 90 ||
    !Number.isFinite(actualizados.longitud) ||
    actualizados.longitud < -180 ||
    actualizados.longitud > 180
  ) {
    return res
      .status(400)
      .json({
        mensaje: "Las coordenadas deben incluir latitud y longitud válidas.",
      });
  }
  db.prepare(
    `
    UPDATE lugares SET nombre = ?, categoria = ?, descripcion = ?, direccion = ?, localidad = ?, provincia = ?, pais = ?,
      telefono = ?, email = ?, latitud = ?, longitud = ?, guardia = ? WHERE id = ?
  `,
  ).run(
    actualizados.nombre,
    actualizados.categoria,
    actualizados.descripcion,
    actualizados.direccion,
    actualizados.localidad,
    actualizados.provincia,
    actualizados.pais,
    actualizados.telefono,
    actualizados.email,
    actualizados.latitud,
    actualizados.longitud,
    actualizados.guardia,
    id,
  );
  res.json(
    vistaLugar(
      db.prepare("SELECT * FROM lugares WHERE id = ?").get(id),
      req.usuario.id,
    ),
  );
});

// Elimina un punto de servicio creado por la cuenta autenticada.
router.delete("/:id", autenticacionRequerida, (req, res) => {
  const id = Number(req.params.id);
  const lugar = db.prepare("SELECT * FROM lugares WHERE id = ?").get(id);
  if (!lugar) return res.status(404).json({ mensaje: "Lugar no encontrado." });
  if (lugar.creador_id !== req.usuario.id)
    return res
      .status(403)
      .json({ mensaje: "Solo quien agregó el punto puede eliminarlo." });
  db.prepare("DELETE FROM lugares WHERE id = ?").run(id);
  res.json({ mensaje: "Punto del mapa eliminado." });
});

export default router;
