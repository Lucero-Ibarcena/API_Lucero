import { Router } from 'express';
import { datos, guardarDatos } from '../data/almacen.js';

const router = Router();

function siguienteId(lista) {
    return lista.reduce((mayor, elemento) => Math.max(mayor, elemento.id), 0) + 1;
}

function buscarPorId(lista, valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? lista.find((elemento) => elemento.id === id) : undefined;
}

function coincide(valor, filtro) {
    return String(valor ?? '').toLowerCase().includes(String(filtro ?? '').toLowerCase());
}

// GET /usuarios?nombre=Ana: lista todos o busca por nombre, email o teléfono.  DEBERIA APARECER DATOS DEL DUEÑO Y SU/S MASCOTA/S REGISTRADAS
router.get('/', (req, res) => {
    const usuarios = datos.usuarios.filter((usuario) =>
        ['nombre', 'email', 'telefono', 'nombre', 'especie', 'raza', 'edad', 'sexo','color', 'tamaño'].every((campo) =>
            req.query[campo] === undefined || coincide(usuario[campo], req.query[campo]),
        ),
    );
    res.json(usuarios);
});

// GET /usuarios/1: busca un usuario por su ID.  DEBERIA APARECER DATOS DEL DUEÑO Y SU/S MASCOTA/S REGISTRADAS
router.get('/:id', (req, res) => {
    const usuario = buscarPorId(datos.usuarios, req.params.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    res.json(usuario);
});

// POST /usuarios: crea un dueño o responsable.  DEBERIA PODER REGISTRAR DATOS DEL DUEÑO Y LOS DE SU/S MASCOTA/S    A ESTO SE LE PUEDE PONER DIRECTAMENTE TODOS
//                                                                                                                  LOS DATOS Y QUEDARIAN REGISTRADOS EN EL
//                                                                                                                  USUARIO, PERO NO EN MASCOTAS
router.post('/', async (req, res) => {
    const { nombre, email = '', telefono = '', direccion = '' } = req.body ?? {};
    if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ mensaje: 'El nombre del usuario es obligatorio.' });
    }

    const usuario = {
        id: siguienteId(datos.usuarios),
        nombre: nombre.trim(),
        email: String(email).trim(),
        telefono: String(telefono).trim(),
        direccion: String(direccion).trim(),
    };
    datos.usuarios.push(usuario);
    await guardarDatos();
    res.status(201).json(usuario);
});

// PUT /usuarios/1: actualiza solo los campos que envíes. NO TOCAR
router.put('/:id', async (req, res) => {
    const usuario = buscarPorId(datos.usuarios, req.params.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ mensaje: 'Envía los cambios como un objeto JSON.' });
    }

    const { id, ...cambios } = req.body;
    Object.assign(usuario, cambios);
    await guardarDatos();
    res.json(usuario);
});

// DELETE /usuarios/1: protege mascotas que todavía pertenecen a ese usuario.  NO TOCAR
router.delete('/:id', async (req, res) => {
    const usuario = buscarPorId(datos.usuarios, req.params.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    if (datos.mascotas.some((mascota) => Number(mascota.usuarioId) === usuario.id)) {
        return res.status(409).json({ mensaje: 'El usuario tiene mascotas registradas.' });
    }

    datos.usuarios = datos.usuarios.filter((elemento) => elemento.id !== usuario.id);
    await guardarDatos();
    res.json({ mensaje: 'Usuario eliminado.', usuario });
});

export default router;