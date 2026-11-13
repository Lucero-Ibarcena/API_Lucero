import { Router } from 'express';
import { datos, guardarDatos } from '../data/almacen.js';

const router = Router();

const nombresDeCampo = {
    nombre: 'nombre',
    nombremascota: 'nombre',
    especie: 'especie',
    raza: 'raza',
    edad: 'edad',
    sexo: 'sexo',
    color: 'color',
    tamano: 'tamano',
    tamaño: 'tamano',
    dueño: 'dueño',
    dueno: 'dueño',
};

//ESTO ES PARA PODER ACEPTAR "CUALQUIER TIPO DE CARACTERES" MIENTRAS CUMPLA LO QUE DEBERIA.  NO TOCAR
function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function buscarPorId(lista, valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? lista.find((elemento) => elemento.id === id) : undefined;
}

function buscarMascotas(campo, valor) {
    const campoReal = nombresDeCampo[normalizar(campo)];
    if (!campoReal) return null;

    if (campoReal === 'dueño') {
        return datos.mascotas.filter((mascota) => {
            const usuario = datos.usuarios.find((elemento) => elemento.id === Number(mascota.usuarioId));
            return normalizar(usuario?.nombre ?? mascota.dueño?.nombre).includes(normalizar(valor));
        });
    }

    return datos.mascotas.filter((mascota) => {
        if (campoReal === 'edad') return Number(mascota.edad) === Number(valor);
        return normalizar(mascota[campoReal]).includes(normalizar(valor));
    });
}

function siguienteId() {
    return datos.mascotas.reduce((mayor, mascota) => Math.max(mayor, mascota.id), 0) + 1;
}

// GET /mascotas?especie=Perro: filtra por una o varias características.
router.get('/', (req, res) => {
    let mascotas = datos.mascotas;
    for (const [campo, valor] of Object.entries(req.query)) {
        if (campo === 'usuarioId') {
            mascotas = mascotas.filter((mascota) => Number(mascota.usuarioId) === Number(valor));
        } else {
            const resultado = buscarMascotas(campo, valor);
            if (resultado) mascotas = mascotas.filter((mascota) => resultado.includes(mascota));
        }
    }
    res.json(mascotas);
});

// Compatibilidad: también acepta rutas como /mascotas/especie/Perro.
router.get('/:campo/:valor', (req, res) => {
    const mascotas = buscarMascotas(req.params.campo, req.params.valor);
    if (!mascotas) return res.status(404).json({ mensaje: 'Característica de búsqueda desconocida.' });
    res.json(mascotas);
});

// GET /mascotas/1: consulta una mascota por ID.
router.get('/:id', (req, res) => {
    const mascota = buscarPorId(datos.mascotas, req.params.id);
    if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
    res.json(mascota);
});

// POST /mascotas: registra una mascota; especie es texto libre.  DEBERIA PODER REGISTRAR DATOS DEL DUEÑO Y LOS DE SU/S MASCOTA/S
router.post('/', async (req, res) => {
    const cuerpo = req.body;
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        return res.status(400).json({ mensaje: 'Envía los datos como un objeto JSON.' });
    }
    if (typeof cuerpo.nombre !== 'string' || !cuerpo.nombre.trim()) {
        return res.status(400).json({ mensaje: 'El nombre de la mascota es obligatorio.' });
    }
    if (typeof cuerpo.especie !== 'string' || !cuerpo.especie.trim()) {
        return res.status(400).json({ mensaje: 'La especie es obligatoria.' });
    }
    if (cuerpo.usuarioId !== undefined && !buscarPorId(datos.usuarios, cuerpo.usuarioId)) {
        return res.status(400).json({ mensaje: 'usuarioId debe ser el ID de un usuario existente.' });
    }



    const mascota = {
        ...cuerpo,
        id: siguienteId(),
        ...(cuerpo.usuarioId !== undefined ? { usuarioId: Number(cuerpo.usuarioId) } : {}),
    };
    datos.mascotas.push(mascota);
    await guardarDatos();
    res.status(201).json(mascota);
});

// PUT /mascotas/1: cambia solo los campos que envíes.  NO TOCAR
router.put('/:id', async (req, res) => {
    const mascota = buscarPorId(datos.mascotas, req.params.id);
    if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ mensaje: 'Envía los cambios como un objeto JSON.' });
    }
    if (req.body.usuarioId !== undefined && !buscarPorId(datos.usuarios, req.body.usuarioId)) {
        return res.status(400).json({ mensaje: 'usuarioId debe ser el ID de un usuario existente.' });
    }

    const { id, ...cambios } = req.body;
    if (cambios.usuarioId !== undefined) cambios.usuarioId = Number(cambios.usuarioId);
    Object.assign(mascota, cambios);
    await guardarDatos();
    res.json(mascota);
});

// DELETE /mascotas/1: elimina una mascota por ID.  NO TOCAR
router.delete('/:id', async (req, res) => {
    const mascota = buscarPorId(datos.mascotas, req.params.id);
    if (!mascota) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });

    datos.mascotas = datos.mascotas.filter((elemento) => elemento.id !== mascota.id);
    await guardarDatos();
    res.json({ mensaje: 'Mascota eliminada.', mascota });
});

export default router;