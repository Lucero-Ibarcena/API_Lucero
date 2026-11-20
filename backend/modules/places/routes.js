import { Router } from 'express';
import { ahora, db } from '../../config/database.js';
import { autenticacionRequerida } from '../../middleware/auth.js';

const router = Router();
const CATEGORIAS = new Set(['veterinaria', 'guardia', 'tienda', 'peluqueria', 'refugio', 'guarderia', 'escuela', 'perrera', 'otro']);


//Helper para geocodificar dirección si el usuario no mandó coordenadas
async function geocodificarDireccion(direccion, localidad, pais) {
  const query = [direccion, localidad, pais].filter(Boolean).join(', ');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LuceroApp/1.0',
        'Accept-Language': 'es',
      },
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        latitud: parseFloat(data[0].lat),
        longitud: parseFloat(data[0].lon),
      };
    }
  } catch (err) {
    console.error('Error al geocodificar:', err.message);
  }
  return null;
}


function vistaLugar(lugar) {
  const lat = lugar.latitud
  const lng = lugar.longitud
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng);

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
    ubicacion: {  latitud: lat, longitud: lng  }, //con esto se "arregla" el uso de latitud y longitud
    guardia: Boolean(lugar.guardia),
    verificado: Boolean(lugar.verificado),
    // Enlace listo para abrir Google Maps y navegar directamente al lugar
    comoLlegarUrl: tieneCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lugar.direccion, lugar.localidad, lugar.pais].filter(Boolean).join(', '))}`,
  };
};


//POR AHORA NO TOCAR
function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = (grados) => grados * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Los puntos pueden ser reportados por usuarios; verificado indica moderación pendiente.

//GET para listar lugares y filtrar por texto o distancia
router.get('/', (req, res) => {
  const condiciones = [];
  const valores = [];
  for (const campo of ['categoria', 'localidad', 'provincia', 'pais']) {
    if (req.query[campo] !== undefined) {
      if (typeof req.query[campo] !== 'string') return res.status(400).json({ mensaje: `El filtro ${campo} debe ser texto.` });
      condiciones.push(`${campo} LIKE ? COLLATE NOCASE`);
      valores.push(`%${req.query[campo]}%`);
    }
  }
  if (req.query.guardia !== undefined) {
    if (!['true', 'false'].includes(req.query.guardia)) return res.status(400).json({ mensaje: 'guardia debe ser true o false.' });
    condiciones.push('guardia = ?');
    valores.push(req.query.guardia === 'true' ? 1 : 0);
  }
  let lugares = db.prepare(`SELECT * FROM lugares${condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : ''} ORDER BY verificado DESC, nombre COLLATE NOCASE`)
    .all(...valores);
  if (req.query.latitud !== undefined || req.query.longitud !== undefined || req.query.radioKm !== undefined) {
    const lat = Number(req.query.latitud);
    const lng = Number(req.query.longitud);
    const radio = Number(req.query.radioKm ?? 25);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(radio) || radio <= 0 || radio > 500) {
      return res.status(400).json({ mensaje: 'Para buscar por distancia indica latitud, longitud y radioKm válidos (máximo 500).' });
    }
    lugares = lugares.filter((lugar) => distanciaKm(lat, lng, lugar.latitud, lugar.longitud) <= radio);
  }
  res.json(lugares.map(vistaLugar));
});

//POST para crear lugares
router.post('/', autenticacionRequerida, (req, res) => {
  const cuerpo = req.body ?? {};
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
  const categoria = typeof cuerpo.categoria === 'string' ? cuerpo.categoria.trim().toLowerCase() : '';
  const localidad = typeof cuerpo.localidad === 'string' ? cuerpo.localidad.trim() : '';
  const pais = typeof cuerpo.pais === 'string' ? cuerpo.pais.trim() : '';
  const latitud = Number(cuerpo.latitud);
  const longitud = Number(cuerpo.longitud);
  if (!nombre || !CATEGORIAS.has(categoria) || !localidad || !pais) {
    return res.status(400).json({ mensaje: 'Se requieren nombre, categoría válida, localidad y país.' });
  }
  for (const campo of ['descripcion', 'direccion', 'provincia', 'telefono', 'email']) {
    if (cuerpo[campo] !== undefined && typeof cuerpo[campo] !== 'string') return res.status(400).json({ mensaje: `${campo} debe ser texto.` });
  }
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90 || !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    return res.status(400).json({ mensaje: 'Las coordenadas deben incluir latitud y longitud válidas.' });
  }
  if (cuerpo.guardia !== undefined && typeof cuerpo.guardia !== 'boolean') return res.status(400).json({ mensaje: 'guardia debe ser verdadero o falso.' });
  const resultado = db.prepare(`
    INSERT INTO lugares
      (creador_id, nombre, categoria, descripcion, direccion, localidad, provincia, pais, telefono, email, latitud, longitud, guardia, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.usuario.id, nombre, categoria, String(cuerpo.descripcion ?? '').trim(), String(cuerpo.direccion ?? '').trim(),
    localidad, String(cuerpo.provincia ?? '').trim(), pais, String(cuerpo.telefono ?? '').trim(),
    String(cuerpo.email ?? '').trim(), latitud, longitud, cuerpo.guardia ? 1 : 0, ahora(),
  );
  const lugar = db.prepare('SELECT * FROM lugares WHERE id = ?').get(Number(resultado.lastInsertRowid));
  res.status(201).json(vistaLugar(lugar));
});

//PUT para modificar lugares
router.put('/:id', autenticacionRequerida, (req, res) => {
  const id = Number(req.params.id);
  const lugar = db.prepare('SELECT * FROM lugares WHERE id = ?').get(id);
  if (!lugar) return res.status(404).json({ mensaje: 'Lugar no encontrado.' });
  if (lugar.creador_id !== req.usuario.id) return res.status(403).json({ mensaje: 'Solo quien agregó el punto puede editarlo.' });
  const cuerpo = req.body;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return res.status(400).json({ mensaje: 'Envía cambios como un objeto JSON.' });
  const campos = ['nombre', 'categoria', 'descripcion', 'direccion', 'localidad', 'provincia', 'pais', 'telefono', 'email', 'latitud', 'longitud', 'guardia'];
  for (const campo of Object.keys(cuerpo)) {
    if (!campos.includes(campo)) return res.status(400).json({ mensaje: `No se puede actualizar el campo "${campo}".` });
  }
  const actualizados = { ...lugar };
  for (const campo of campos) {
    if (cuerpo[campo] === undefined) continue;
    if (['latitud', 'longitud'].includes(campo)) actualizados[campo] = Number(cuerpo[campo]);
    else if (campo === 'guardia') {
      if (typeof cuerpo.guardia !== 'boolean') return res.status(400).json({ mensaje: 'guardia debe ser verdadero o falso.' });
      actualizados.guardia = cuerpo.guardia ? 1 : 0;
    } else {
      if (typeof cuerpo[campo] !== 'string') return res.status(400).json({ mensaje: `${campo} debe ser texto.` });
      actualizados[campo] = campo === 'categoria' ? cuerpo[campo].trim().toLowerCase() : cuerpo[campo].trim();
    }
  }
  if (!actualizados.nombre || !actualizados.localidad || !actualizados.pais || !CATEGORIAS.has(actualizados.categoria)) {
    return res.status(400).json({ mensaje: 'El nombre, localidad, país y categoría deben seguir siendo válidos.' });
  }
  if (!Number.isFinite(actualizados.latitud) || actualizados.latitud < -90 || actualizados.latitud > 90 || !Number.isFinite(actualizados.longitud) || actualizados.longitud < -180 || actualizados.longitud > 180) {
    return res.status(400).json({ mensaje: 'Las coordenadas deben incluir latitud y longitud válidas.' });
  }
  db.prepare(`
    UPDATE lugares SET nombre = ?, categoria = ?, descripcion = ?, direccion = ?, localidad = ?, provincia = ?, pais = ?,
      telefono = ?, email = ?, latitud = ?, longitud = ?, guardia = ? WHERE id = ?
  `).run(actualizados.nombre, actualizados.categoria, actualizados.descripcion, actualizados.direccion, actualizados.localidad,
    actualizados.provincia, actualizados.pais, actualizados.telefono, actualizados.email, actualizados.latitud,
    actualizados.longitud, actualizados.guardia, id);
  res.json(vistaLugar(db.prepare('SELECT * FROM lugares WHERE id = ?').get(id)));
});


//DELETE para borrar lugares
router.delete('/:id', autenticacionRequerida, (req, res) => {
  const id = Number(req.params.id);
  const lugar = db.prepare('SELECT * FROM lugares WHERE id = ?').get(id);
  if (!lugar) return res.status(404).json({ mensaje: 'Lugar no encontrado.' });
  if (lugar.creador_id !== req.usuario.id) return res.status(403).json({ mensaje: 'Solo quien agregó el punto puede eliminarlo.' });
  db.prepare('DELETE FROM lugares WHERE id = ?').run(id);
  res.json({ mensaje: 'Punto del mapa eliminado.' });
});

export default router;