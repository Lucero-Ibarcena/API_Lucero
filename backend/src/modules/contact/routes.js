import { Router } from "express";
import { ahora, db, responsablePrincipal } from "../../config/database.js";
import { obtenerDocumento } from "../../config/documentos.js";
import { autenticacionRequerida } from "../../middleware/auth.js";

// Endpoints privados para solicitudes de contacto y permisos de datos personales.
const router = Router();
router.use(autenticacionRequerida);

/** Adapta una solicitud al punto de vista de quien la consulta. */
function vistaSolicitud(fila, usuarioId) {
  const recibida = fila.destinatario_id === usuarioId;
  const nombreRemitente = fila.mostrar_nombre_publico
    ? fila.nombre_publico || fila.nombre_solicitante
    : "Usuario registrado";
  const nombreDestinatario = fila.mostrar_nombre_destinatario
    ? fila.nombre_publico_destinatario || fila.nombre_destinatario
    : null;
  return {
    id: fila.id,
    mascotaId: fila.mascota_id,
    mensaje: fila.mensaje,
    estado: fila.estado,
    compartirContacto: Boolean(fila.compartir_contacto),
    creadaEn: fila.creado_en,
    respondidaEn: fila.respondido_en,
    remitente: recibida ? { nombre: nombreRemitente } : null,
    destinatario: recibida ? null : { nombre: nombreDestinatario },
  };
}

// Envía una solicitud dentro de la app sin exponer el email o teléfono del responsable.
router.post("/solicitudes", (req, res) => {
  const { mascotaId, mensaje } = req.body ?? {};
  if (
    typeof mascotaId !== "string" ||
    typeof mensaje !== "string" ||
    mensaje.trim().length < 10 ||
    mensaje.trim().length > 1000
  ) {
    return res
      .status(400)
      .json({
        mensaje: "Envía mascotaId y un mensaje de entre 10 y 1000 caracteres.",
      });
  }
  const mascota = obtenerDocumento(mascotaId);
  if (!mascota || !mascota.publicar)
    return res.status(404).json({ mensaje: "Mascota no encontrada." });
  const destinatario = responsablePrincipal(mascotaId);
  if (!destinatario)
    return res
      .status(409)
      .json({
        mensaje: "Esta mascota todavía no tiene un responsable de contacto.",
      });
  if (destinatario.id === req.usuario.id)
    return res
      .status(400)
      .json({
        mensaje: "No puedes enviarte una solicitud a tu propia cuenta.",
      });
  const pendiente = db
    .prepare(
      `
    SELECT 1 FROM solicitudes_contacto
    WHERE mascota_id = ? AND solicitante_id = ? AND destinatario_id = ? AND estado = 'pendiente'
  `,
    )
    .get(mascotaId, req.usuario.id, destinatario.id);
  if (pendiente)
    return res
      .status(409)
      .json({
        mensaje: "Ya tienes una solicitud pendiente para esta mascota.",
      });
  const resultado = db
    .prepare(
      `
    INSERT INTO solicitudes_contacto (mascota_id, solicitante_id, destinatario_id, mensaje, creado_en)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(mascotaId, req.usuario.id, destinatario.id, mensaje.trim(), ahora());
  res
    .status(201)
    .json({
      id: Number(resultado.lastInsertRowid),
      estado: "pendiente",
      mensaje: "Solicitud enviada dentro de la app.",
    });
});

// Lista las solicitudes enviadas y recibidas por la cuenta autenticada.
router.get("/solicitudes", (req, res) => {
  const filas = db
    .prepare(
      `
    SELECT c.*,
           u.nombre AS nombre_solicitante, u.nombre_publico, u.mostrar_nombre_publico,
           d.nombre AS nombre_destinatario, d.nombre_publico AS nombre_publico_destinatario,
           d.mostrar_nombre_publico AS mostrar_nombre_destinatario
    FROM solicitudes_contacto c
    JOIN usuarios u ON u.id = c.solicitante_id
    JOIN usuarios d ON d.id = c.destinatario_id
    WHERE c.solicitante_id = ? OR c.destinatario_id = ?
    ORDER BY c.id DESC
  `,
    )
    .all(req.usuario.id, req.usuario.id);
  res.json(filas.map((fila) => vistaSolicitud(fila, req.usuario.id)));
});

// Permite al destinatario aceptar o rechazar y elegir si comparte su contacto.
router.patch("/solicitudes/:id", (req, res) => {
  const id = Number(req.params.id);
  const solicitud = db
    .prepare("SELECT * FROM solicitudes_contacto WHERE id = ?")
    .get(id);
  if (!solicitud)
    return res.status(404).json({ mensaje: "Solicitud no encontrada." });
  if (solicitud.destinatario_id !== req.usuario.id)
    return res
      .status(403)
      .json({ mensaje: "Solo el responsable puede responder esta solicitud." });
  if (solicitud.estado !== "pendiente")
    return res.status(409).json({ mensaje: "La solicitud ya fue respondida." });
  const decision = req.body?.decision;
  const compartir = req.body?.compartirContacto ?? false;
  if (
    !["aceptar", "rechazar"].includes(decision) ||
    typeof compartir !== "boolean"
  ) {
    return res
      .status(400)
      .json({
        mensaje:
          "Envía decision como aceptar o rechazar y compartirContacto como verdadero o falso.",
      });
  }
  if (decision === "rechazar" && compartir)
    return res
      .status(400)
      .json({
        mensaje: "No se puede compartir contacto al rechazar la solicitud.",
      });
  const estado = decision === "aceptar" ? "aceptada" : "rechazada";
  db.prepare(
    `UPDATE solicitudes_contacto SET estado = ?, compartir_contacto = ?, respondido_en = ? WHERE id = ?`,
  ).run(estado, compartir ? 1 : 0, ahora(), id);
  res.json({ id, estado, compartirContacto: compartir });
});

// Permite cancelar una solicitud pendiente enviada por la cuenta actual.
router.delete("/solicitudes/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    return res.status(404).json({ mensaje: "Solicitud no encontrada." });
  const solicitud = db
    .prepare("SELECT solicitante_id, estado FROM solicitudes_contacto WHERE id = ?")
    .get(id);
  if (!solicitud)
    return res.status(404).json({ mensaje: "Solicitud no encontrada." });
  if (solicitud.solicitante_id !== req.usuario.id)
    return res
      .status(403)
      .json({ mensaje: "Solo quien envió la solicitud puede cancelarla." });
  if (solicitud.estado !== "pendiente")
    return res
      .status(409)
      .json({ mensaje: "Solo se pueden cancelar solicitudes pendientes." });
  db.prepare("DELETE FROM solicitudes_contacto WHERE id = ?").run(id);
  res.json({ mensaje: "Solicitud cancelada." });
});

// Devuelve los datos de contacto solo después de la autorización del responsable.
router.get("/solicitudes/:id/contacto", (req, res) => {
  const id = Number(req.params.id);
  const solicitud = db
    .prepare("SELECT * FROM solicitudes_contacto WHERE id = ?")
    .get(id);
  if (!solicitud)
    return res.status(404).json({ mensaje: "Solicitud no encontrada." });
  if (
    solicitud.solicitante_id !== req.usuario.id &&
    solicitud.destinatario_id !== req.usuario.id
  ) {
    return res
      .status(403)
      .json({ mensaje: "No tienes acceso a esta solicitud." });
  }
  if (solicitud.estado !== "aceptada" || !solicitud.compartir_contacto) {
    return res
      .status(403)
      .json({
        mensaje:
          "El responsable todavía no autorizó compartir sus datos de contacto.",
      });
  }
  const responsable = db
    .prepare("SELECT email, telefono FROM usuarios WHERE id = ?")
    .get(solicitud.destinatario_id);
  res.json({
    email: responsable.email,
    telefono: responsable.telefono || null,
  });
});

// Revoca el acceso previamente concedido a los datos de contacto.
router.delete("/solicitudes/:id/contacto", (req, res) => {
  const id = Number(req.params.id);
  const solicitud = db
    .prepare(
      "SELECT destinatario_id, estado, compartir_contacto FROM solicitudes_contacto WHERE id = ?",
    )
    .get(id);
  if (!solicitud)
    return res.status(404).json({ mensaje: "Solicitud no encontrada." });
  if (solicitud.destinatario_id !== req.usuario.id)
    return res
      .status(403)
      .json({
        mensaje: "Solo quien compartió los datos puede revocar el acceso.",
      });
  if (!solicitud.compartir_contacto)
    return res
      .status(409)
      .json({
        mensaje: "No hay datos de contacto compartidos en esta solicitud.",
      });
  db.prepare(
    "UPDATE solicitudes_contacto SET compartir_contacto = 0 WHERE id = ?",
  ).run(id);
  res.json({ mensaje: "Acceso a los canales de contacto revocado." });
});

export default router;
