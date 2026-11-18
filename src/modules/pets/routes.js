import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { agregarResponsable, ahora, db, esResponsablePrincipal, puedeAdministrarMascota, responsablePrincipal, responsablesPublicos, usuarioPublico } from '../../config/database.js';
import { eliminarDocumento, guardarDocumento, listarDocumentos, obtenerDocumento } from '../../config/documentos.js';
import { autenticacionOpcional, autenticacionRequerida } from '../../middleware/auth.js';

const router = Router();
const CAMPOS_PERFIL = [
  'nombre', 'especie', 'raza', 'edad', 'fechaNacimiento', 'sexo', 'tamano', 'color', 'colores',
  'senasParticulares', 'descripcion', 'fotos', 'ubicacion', 'salud', 'identificacion', 'comportamiento',
];
const ESTADOS = new Set(['registrada', 'perdida', 'en_adopcion', 'en_refugio', 'en_transito', 'encontrada', 'adoptada']);
const ALIAS = {
  nombremascota: 'nombre', animal: 'especie', tamano: 'tamano', color: 'colores',
  vacunado: 'vacunado', localidad: 'localidad', ciudad: 'localidad', provincia: 'provincia',
  pais: 'pais', edad: 'edad', sexo: 'sexo', raza: 'raza', especie: 'especie', estado: 'estado',
  status: 'estado', q: 'busqueda', dueno: 'responsable', responsable: 'responsable', cuidador: 'responsable',
};

function normalizar(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function encontrarPerfil(cuerpo) {
  return cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo);
}

function tomarCampos(cuerpo) {
  const perfil = {};
  for (const campo of CAMPOS_PERFIL) {
    if (Object.hasOwn(cuerpo, campo)) perfil[campo] = cuerpo[campo];
  }
  if (Object.hasOwn(cuerpo, 'publicar')) perfil.publicar = cuerpo.publicar;
  return perfil;
}

function validarCampos(perfil, parcial = false) {
  if (!parcial && (typeof perfil.nombre !== 'string' || !perfil.nombre.trim())) return 'El nombre de la mascota es obligatorio.';
  if (!parcial && (typeof perfil.especie !== 'string' || !perfil.especie.trim())) return 'La especie es obligatoria.';
  for (const campo of ['nombre', 'especie']) {
    if (perfil[campo] !== undefined && (typeof perfil[campo] !== 'string' || !perfil[campo].trim())) return `El campo ${campo} debe ser texto no vacío.`;
  }
  for (const campo of ['raza', 'fechaNacimiento', 'sexo', 'tamano', 'senasParticulares', 'descripcion']) {
    if (perfil[campo] !== undefined && typeof perfil[campo] !== 'string') return `${campo} debe ser texto.`;
  }
  if (perfil.edad !== undefined && (!Number.isFinite(Number(perfil.edad)) || Number(perfil.edad) < 0)) return 'La edad debe ser un número igual o mayor que cero.';
  if (perfil.color !== undefined && typeof perfil.color !== 'string') return 'color debe ser texto.';
  if (perfil.publicar !== undefined && typeof perfil.publicar !== 'boolean') return 'publicar debe ser verdadero o falso.';
  for (const campo of ['colores', 'fotos']) {
    if (perfil[campo] !== undefined && !Array.isArray(perfil[campo])) return `${campo} debe ser una lista.`;
    if (Array.isArray(perfil[campo]) && perfil[campo].some((item) => typeof item !== 'string')) return `${campo} solo puede contener texto.`;
  }
  for (const campo of ['ubicacion', 'salud', 'identificacion', 'comportamiento']) {
    if (perfil[campo] !== undefined && (!perfil[campo] || typeof perfil[campo] !== 'object' || Array.isArray(perfil[campo]))) return `${campo} debe ser un objeto.`;
  }
  return null;
}

function proyeccionPublica(mascota) {
  const camposPublicos = [
    'id', 'nombre', 'especie', 'raza', 'edad', 'fechaNacimiento', 'sexo', 'tamano',
    'color', 'colores', 'senasParticulares', 'descripcion', 'fotos', 'estado', 'creadoEn', 'actualizadoEn',
  ];
  const salida = Object.fromEntries(camposPublicos
    .filter((campo) => mascota[campo] !== undefined)
    .map((campo) => [campo, structuredClone(mascota[campo])]));
  if (mascota.ubicacion) {
    salida.ubicacion = Object.fromEntries(['localidad', 'provincia', 'pais']
      .filter((campo) => typeof mascota.ubicacion[campo] === 'string')
      .map((campo) => [campo, mascota.ubicacion[campo]]));
  }
  if (mascota.salud) {
    salida.salud = Object.fromEntries(['vacunado', 'esterilizada']
      .filter((campo) => typeof mascota.salud[campo] === 'boolean')
      .map((campo) => [campo, mascota.salud[campo]]));
  }
  if (mascota.reportePerdida) {
    const reporte = mascota.reportePerdida;
    salida.reportePerdida = Object.fromEntries(['fecha', 'localidad', 'provincia', 'pais', 'descripcion']
      .filter((campo) => typeof reporte[campo] === 'string')
      .map((campo) => [campo, reporte[campo]]));
  }
  salida.responsable = usuarioPublico(responsablePrincipal(mascota.id));
  salida.responsablesPublicos = responsablesPublicos(mascota.id);
  return salida;
}

function aPropietario(mascota) {
  return structuredClone(mascota);
}

function valorCampo(mascota, campo) {
  switch (campo) {
    case 'busqueda': return [mascota.nombre, mascota.especie, mascota.raza].filter(Boolean);
    case 'colores': return mascota.colores ?? (mascota.color ? [mascota.color] : []);
    case 'localidad': return (mascota.estado === 'perdida' ? mascota.reportePerdida?.localidad : null) ?? mascota.ubicacion?.localidad ?? '';
    case 'provincia': return (mascota.estado === 'perdida' ? mascota.reportePerdida?.provincia : null) ?? mascota.ubicacion?.provincia ?? '';
    case 'pais': return (mascota.estado === 'perdida' ? mascota.reportePerdida?.pais : null) ?? mascota.ubicacion?.pais ?? '';
    case 'estado': return mascota.estado;
    case 'vacunado': return mascota.salud?.vacunado ?? mascota.vacunado ?? false;
    case 'responsable': {
      return responsablesPublicos(mascota.id).map((usuario) => usuario.nombre);
    }
    default: return mascota[campo];
  }
}

function coincide(mascota, campo, filtro) {
  const valor = valorCampo(mascota, campo);
  if (campo === 'busqueda') return valor.some((elemento) => normalizar(elemento).includes(normalizar(filtro)));
  if (campo === 'edad') return Number(valor) === Number(filtro);
  if (campo === 'vacunado') return String(Boolean(valor)) === normalizar(filtro) || String(valor) === normalizar(filtro);
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista.some((elemento) => normalizar(elemento).includes(normalizar(filtro)));
}

function responsableAutorizado(req, res, mascota, soloPrincipal = false) {
  const valido = soloPrincipal
    ? esResponsablePrincipal(mascota.id, req.usuario.id)
    : puedeAdministrarMascota(mascota.id, req.usuario.id);
  if (!valido) {
    res.status(403).json({ mensaje: 'No tienes permisos para modificar esta mascota.' });
    return false;
  }
  return true;
}

function retirarPermisosDeContacto(mascotaId) {
  db.prepare(`
    UPDATE solicitudes_contacto
    SET estado = CASE WHEN estado = 'pendiente' THEN 'rechazada' ELSE estado END,
        compartir_contacto = 0,
        respondido_en = CASE WHEN estado = 'pendiente' THEN ? ELSE respondido_en END
    WHERE mascota_id = ?
  `).run(ahora(), mascotaId);
}

// Lista privada de mascotas vinculadas a la cuenta autenticada.
router.get('/propias', autenticacionRequerida, (req, res) => {
  const ids = db.prepare(`SELECT mascota_id FROM responsables_mascota WHERE usuario_id = ? AND estado = 'activo'`)
    .all(req.usuario.id).map((fila) => fila.mascota_id);
  res.json(ids.map((id) => obtenerDocumento(id)).filter(Boolean).map(aPropietario));
});

router.get('/invitaciones', autenticacionRequerida, (req, res) => {
  const invitaciones = db.prepare(`
    SELECT r.mascota_id, r.rol, r.creado_en
    FROM responsables_mascota r
    WHERE r.usuario_id = ? AND r.estado = 'pendiente'
  `).all(req.usuario.id);
  res.json(invitaciones.map((invitacion) => {
    const mascota = obtenerDocumento(invitacion.mascota_id);
    return {
      mascotaId: invitacion.mascota_id,
      rol: invitacion.rol,
      creadaEn: invitacion.creado_en,
      mascota: mascota ? { nombre: mascota.nombre, especie: mascota.especie } : null,
    };
  }));
});

// GET /mascotas: búsqueda pública por varias categorías. Solo devuelve perfiles publicados.
router.get('/', (req, res) => {
  const filtros = [];
  for (const [campoOriginal, valor] of Object.entries(req.query)) {
    const campo = ALIAS[normalizar(campoOriginal)];
    if (!campo || Array.isArray(valor)) return res.status(400).json({ mensaje: `Filtro no válido: ${campoOriginal}.` });
    filtros.push([campo, valor]);
  }
  const resultados = listarDocumentos()
    .filter((mascota) => mascota.publicar === true)
    .filter((mascota) => filtros.every(([campo, valor]) => coincide(mascota, campo, valor)))
    .map(proyeccionPublica);
  res.json(resultados);
});

// POST /mascotas: añade una mascota al perfil del usuario autenticado.
router.post('/', autenticacionRequerida, async (req, res) => {
  if (!encontrarPerfil(req.body)) return res.status(400).json({ mensaje: 'Envía los datos como un objeto JSON.' });
  for (const campo of Object.keys(req.body)) {
    if (![...CAMPOS_PERFIL, 'publicar'].includes(campo)) return res.status(400).json({ mensaje: `Campo no reconocido: ${campo}.` });
  }
  const perfil = tomarCampos(req.body);
  const error = validarCampos(perfil);
  if (error) return res.status(400).json({ mensaje: error });
  const mascota = {
    id: randomUUID(),
    ...perfil,
    nombre: perfil.nombre.trim(),
    especie: perfil.especie.trim(),
    ...(perfil.edad !== undefined ? { edad: Number(perfil.edad) } : {}),
    publicar: perfil.publicar === true,
    estado: 'registrada',
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };
  await guardarDocumento(mascota);
  agregarResponsable(mascota.id, req.usuario.id, 'principal');
  res.status(201).json(aPropietario(mascota));
});

// Reportar como perdida publica la zona general y conserva las coordenadas exactas en privado.
router.post('/:id/reportes/perdida', autenticacionRequerida, async (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (!responsableAutorizado(req, res, mascota)) return;
  const cuerpo = req.body;
  if (!encontrarPerfil(cuerpo) || typeof cuerpo.localidad !== 'string' || !cuerpo.localidad.trim()) {
    return res.status(400).json({ mensaje: 'El reporte requiere una localidad aproximada.' });
  }
  const latitud = cuerpo.latitud === undefined ? null : Number(cuerpo.latitud);
  const longitud = cuerpo.longitud === undefined ? null : Number(cuerpo.longitud);
  if ((latitud === null) !== (longitud === null) || (latitud !== null && (!Number.isFinite(latitud) || latitud < -90 || latitud > 90 || !Number.isFinite(longitud) || longitud < -180 || longitud > 180))) {
    return res.status(400).json({ mensaje: 'Las coordenadas deben incluir latitud y longitud válidas.' });
  }
  mascota.estado = 'perdida';
  mascota.publicar = true;
  mascota.reportePerdida = {
    fecha: typeof cuerpo.fecha === 'string' ? cuerpo.fecha : new Date().toISOString(),
    localidad: cuerpo.localidad.trim(),
    provincia: String(cuerpo.provincia ?? '').trim(),
    pais: String(cuerpo.pais ?? '').trim(),
    descripcion: String(cuerpo.descripcion ?? '').trim(),
    ...(latitud !== null ? { ubicacionExacta: { latitud, longitud } } : {}),
  };
  mascota.actualizadoEn = new Date().toISOString();
  await guardarDocumento(mascota);
  res.json(aPropietario(mascota));
});

// Invita a una cuenta existente y requiere que esa persona acepte la responsabilidad.
router.post('/:id/responsables', autenticacionRequerida, (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (!responsableAutorizado(req, res, mascota, true)) return;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const rol = req.body?.rol;
  if (!email || !['cuidador', 'refugio', 'transito'].includes(rol)) {
    return res.status(400).json({ mensaje: 'Envía el email de una cuenta y un rol: cuidador, refugio o transito.' });
  }
  const invitado = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (!invitado) return res.status(404).json({ mensaje: 'No existe una cuenta con ese email.' });
  if (invitado.id === req.usuario.id) return res.status(400).json({ mensaje: 'Ya eres el responsable principal.' });
  const existente = db.prepare('SELECT estado FROM responsables_mascota WHERE mascota_id = ? AND usuario_id = ?').get(mascota.id, invitado.id);
  if (existente?.estado === 'activo') return res.status(409).json({ mensaje: 'Esa cuenta ya tiene acceso al perfil.' });
  if (existente?.estado === 'pendiente') return res.status(409).json({ mensaje: 'Ya hay una invitación pendiente para esa cuenta.' });
  agregarResponsable(mascota.id, invitado.id, rol, 'pendiente');
  res.status(202).json({ mensaje: 'Invitación enviada. La otra persona debe aceptarla.', estado: 'pendiente' });
});

router.get('/:id/responsables', autenticacionRequerida, (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (!puedeAdministrarMascota(mascota.id, req.usuario.id)) return res.status(403).json({ mensaje: 'No tienes permiso para ver este perfil.' });
  const filas = db.prepare(`
    SELECT r.usuario_id, r.rol, r.estado, u.nombre, u.nombre_publico, u.mostrar_nombre_publico
    FROM responsables_mascota r JOIN usuarios u ON u.id = r.usuario_id
    WHERE r.mascota_id = ? ORDER BY CASE r.rol WHEN 'principal' THEN 0 ELSE 1 END, u.nombre
  `).all(mascota.id);
  res.json(filas.map((fila) => ({
    usuarioId: fila.usuario_id,
    nombre: fila.mostrar_nombre_publico ? (fila.nombre_publico || fila.nombre) : undefined,
    rol: fila.rol,
    estado: fila.estado,
  })));
});

router.post('/:id/responsables/aceptar', autenticacionRequerida, (req, res) => {
  const invitacion = db.prepare(`
    SELECT rol FROM responsables_mascota WHERE mascota_id = ? AND usuario_id = ? AND estado = 'pendiente'
  `).get(req.params.id, req.usuario.id);
  if (!invitacion) return res.status(404).json({ mensaje: 'No tienes una invitación pendiente para esta mascota.' });
  db.prepare(`UPDATE responsables_mascota SET estado = 'activo' WHERE mascota_id = ? AND usuario_id = ?`)
    .run(req.params.id, req.usuario.id);
  res.json({ mensaje: 'Invitación aceptada.', mascotaId: req.params.id, rol: invitacion.rol });
});

router.delete('/:id/responsables/:usuarioId', autenticacionRequerida, (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (!responsableAutorizado(req, res, mascota, true)) return;
  const usuarioId = Number(req.params.usuarioId);
  const resultado = db.prepare(`DELETE FROM responsables_mascota WHERE mascota_id = ? AND usuario_id = ? AND rol <> 'principal'`)
    .run(mascota.id, usuarioId);
  if (!resultado.changes) return res.status(404).json({ mensaje: 'Responsable secundario no encontrado.' });
  res.json({ mensaje: 'Responsabilidad compartida revocada.' });
});

router.patch('/:id/estado', autenticacionRequerida, async (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (!responsableAutorizado(req, res, mascota)) return;
  const { estado } = req.body ?? {};
  if (!ESTADOS.has(estado) || estado === 'perdida') {
    return res.status(400).json({ mensaje: 'Estado no válido. Para marcarla como perdida, crea un reporte de pérdida.' });
  }
  mascota.estado = estado;
  if (['en_adopcion', 'en_refugio', 'en_transito', 'encontrada'].includes(estado)) mascota.publicar = true;
  if (estado === 'encontrada' && mascota.reportePerdida) delete mascota.reportePerdida.ubicacionExacta;
  if (estado === 'adoptada') {
    mascota.publicar = false;
    retirarPermisosDeContacto(mascota.id);
  }
  mascota.actualizadoEn = new Date().toISOString();
  await guardarDocumento(mascota);
  res.json(aPropietario(mascota));
});

router.put('/:id', autenticacionRequerida, async (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (!responsableAutorizado(req, res, mascota)) return;
  if (!encontrarPerfil(req.body)) return res.status(400).json({ mensaje: 'Envía los cambios como un objeto JSON.' });
  for (const campo of Object.keys(req.body)) {
    if (![...CAMPOS_PERFIL, 'publicar'].includes(campo)) return res.status(400).json({ mensaje: `No se puede actualizar el campo "${campo}".` });
  }
  const cambios = tomarCampos(req.body);
  const error = validarCampos(cambios, true);
  if (error) return res.status(400).json({ mensaje: error });
  Object.assign(mascota, cambios);
  if (cambios.nombre) mascota.nombre = cambios.nombre.trim();
  if (cambios.especie) mascota.especie = cambios.especie.trim();
  if (cambios.edad !== undefined) mascota.edad = Number(cambios.edad);
  mascota.actualizadoEn = new Date().toISOString();
  await guardarDocumento(mascota);
  if (mascota.publicar === false) retirarPermisosDeContacto(mascota.id);
  res.json(aPropietario(mascota));
});

router.delete('/:id', autenticacionRequerida, async (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (!responsableAutorizado(req, res, mascota, true)) return;
  db.prepare('DELETE FROM responsables_mascota WHERE mascota_id = ?').run(mascota.id);
  db.prepare('DELETE FROM solicitudes_contacto WHERE mascota_id = ?').run(mascota.id);
  await eliminarDocumento(mascota.id);
  res.json({ mensaje: 'Mascota eliminada.' });
});

router.get('/:id', autenticacionOpcional, (req, res) => {
  const mascota = obtenerDocumento(req.params.id);
  if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  if (req.usuario && puedeAdministrarMascota(mascota.id, req.usuario.id)) return res.json(aPropietario(mascota));
  if (!mascota.publicar) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
  res.json(proyeccionPublica(mascota));
});

// Compatibilidad con búsqueda por ruta, por ejemplo /mascotas/especie/perro.
router.get('/:campo/:valor', (req, res) => {
  const campo = ALIAS[normalizar(req.params.campo)];
  if (!campo) return res.status(404).json({ mensaje: 'Categoría de búsqueda desconocida.' });
  res.json(listarDocumentos()
    .filter((mascota) => mascota.publicar === true && coincide(mascota, campo, req.params.valor))
    .map(proyeccionPublica));
});

export default router;
