import { createHash } from 'node:crypto';
import { db } from '../config/database.js';


export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function autenticacionRequerida(req, res, next) {
  const autorizacion = req.get('authorization') || '';
  const coincidencia = autorizacion.match(/^Bearer\s+(.+)$/i);
  if (!coincidencia) return res.status(401).json({ mensaje: 'Inicia sesión para realizar esta acción.' });

  const sesion = db.prepare(`
    SELECT u.id, u.nombre, u.nombre_publico, u.mostrar_nombre_publico, u.email,
           u.telefono, u.pais, u.localidad, u.creado_en, s.vence_en
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ?
  `).get(tokenHash(coincidencia[1]));

  if (!sesion || Date.parse(sesion.vence_en) <= Date.now()) {
    if (sesion) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(tokenHash(coincidencia[1]));
    return res.status(401).json({ mensaje: 'La sesión no es válida o venció. Inicia sesión nuevamente.' });
  }
  req.usuario = sesion;
  next();
}

export function autenticacionOpcional(req, res, next) {
  if (!req.get('authorization')) return next();
  return autenticacionRequerida(req, res, next);
}

