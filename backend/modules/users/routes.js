import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { ahora, db, vistaUsuario } from '../../config/database.js';
import { autenticacionRequerida, tokenHash } from '../../middleware/auth.js';


const router = Router();
const DIAS_SESION = 7;

function crearSesion(usuarioId) {
  const token = randomBytes(32).toString('base64url');
  const vence = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sesiones (token_hash, usuario_id, vence_en, creado_en) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), usuarioId, vence, ahora());
  return { token, venceEn: vence };
}

function validarContrasena(valor) {
  return typeof valor === 'string' && valor.length >= 12 && valor.length <= 128;
}

// POST /usuarios: crea la cuenta y devuelve una sesión de siete días.
router.post('/', (req, res) => {
  const cuerpo = req.body;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return res.status(400).json({ mensaje: 'Envía los datos como un objeto JSON.' });
  }
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
  const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim().toLowerCase() : '';
  if (!nombre) return res.status(400).json({ mensaje: 'El nombre es obligatorio.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ mensaje: 'Ingresa un email válido.' });
  }
  if (!validarContrasena(cuerpo.contrasena)) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener entre 12 y 128 caracteres.' });
  }
  if (cuerpo.mostrarNombrePublico !== undefined && typeof cuerpo.mostrarNombrePublico !== 'boolean') {
    return res.status(400).json({ mensaje: 'mostrarNombrePublico debe ser verdadero o falso.' });
  }
  for (const campo of ['nombrePublico', 'telefono', 'pais', 'localidad']) {
    if (cuerpo[campo] !== undefined && typeof cuerpo[campo] !== 'string') {
      return res.status(400).json({ mensaje: `${campo} debe ser texto.` });
    }
  }

  const sal = randomBytes(16);
  const hash = scryptSync(cuerpo.contrasena, sal, 64).toString('hex');
  try {
    const resultado = db.prepare(`
      INSERT INTO usuarios
        (nombre, nombre_publico, mostrar_nombre_publico, email, hash_contrasena, sal_contrasena,
         telefono, pais, localidad, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nombre,
      String(cuerpo.nombrePublico ?? '').trim(),
      cuerpo.mostrarNombrePublico ? 1 : 0,
      email,
      hash,
      sal.toString('hex'),
      String(cuerpo.telefono ?? '').trim(),
      String(cuerpo.pais ?? '').trim(),
      String(cuerpo.localidad ?? '').trim(),
      ahora(),
    );
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(Number(resultado.lastInsertRowid));
    return res.status(201).json({ usuario: vistaUsuario(usuario), sesion: crearSesion(usuario.id) });
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(error.message)) {
      return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese email.' });
    }
    throw error;
  }
});

// POST /usuarios/login: inicia sesión con email y contraseña.
router.post('/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const contrasena = req.body?.contrasena;
  if (!email || typeof contrasena !== 'string' || contrasena.length > 128) {
    return res.status(400).json({ mensaje: 'Envía email y contraseña.' });
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario) return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
  const esperado = Buffer.from(usuario.hash_contrasena, 'hex');
  const recibido = scryptSync(contrasena, Buffer.from(usuario.sal_contrasena, 'hex'), esperado.length);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
    return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
  }
  return res.json({ usuario: vistaUsuario(usuario), sesion: crearSesion(usuario.id) });
});

router.get('/me', autenticacionRequerida, (req, res) => {
  res.json({ usuario: vistaUsuario(req.usuario) });
});

router.patch('/me', autenticacionRequerida, (req, res) => {
  const cuerpo = req.body;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return res.status(400).json({ mensaje: 'Envía los cambios como un objeto JSON.' });
  }
  const campos = {
    nombre: (valor) => typeof valor === 'string' && valor.trim() ? valor.trim() : null,
    nombrePublico: (valor) => typeof valor === 'string' ? valor.trim() : null,
    mostrarNombrePublico: (valor) => typeof valor === 'boolean' ? Number(valor) : null,
    telefono: (valor) => typeof valor === 'string' ? valor.trim() : null,
    pais: (valor) => typeof valor === 'string' ? valor.trim() : null,
    localidad: (valor) => typeof valor === 'string' ? valor.trim() : null,
  };
  const columnas = { nombre: 'nombre', nombrePublico: 'nombre_publico', mostrarNombrePublico: 'mostrar_nombre_publico', telefono: 'telefono', pais: 'pais', localidad: 'localidad' };
  const cambios = [];
  const valores = [];
  for (const [campo, valor] of Object.entries(cuerpo)) {
    if (!campos[campo]) return res.status(400).json({ mensaje: `No se puede modificar el campo "${campo}".` });
    const convertido = campos[campo](valor);
    if (convertido === null) return res.status(400).json({ mensaje: `El valor de "${campo}" no es válido.` });
    cambios.push(`${columnas[campo]} = ?`);
    valores.push(convertido);
  }
  if (cambios.length === 0) return res.status(400).json({ mensaje: 'Envía al menos un campo para actualizar.' });
  valores.push(req.usuario.id);
  db.prepare(`UPDATE usuarios SET ${cambios.join(', ')} WHERE id = ?`).run(...valores);
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  res.json({ usuario: vistaUsuario(usuario) });
});

router.post('/logout', autenticacionRequerida, (req, res) => {
  const hash = tokenHash(req.get('authorization').replace(/^Bearer\s+/i, ''));
  db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(hash);
  res.json({ mensaje: 'Sesión cerrada.' });
});

// La consulta pública de un usuario solo devuelve su nombre si decidió mostrarlo.
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  const usuario = db.prepare('SELECT id, nombre, nombre_publico, mostrar_nombre_publico FROM usuarios WHERE id = ?').get(id);
  if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  res.json({ usuario: usuario.mostrar_nombre_publico ? { id: usuario.id, nombre: usuario.nombre_publico || usuario.nombre } : { id: usuario.id } });
});

export default router;
