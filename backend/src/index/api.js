import { Router } from "express";
import contactRoutes from "../modules/contact/routes.js";
import petRoutes from "../modules/pets/routes.js";
import placeRoutes from "../modules/places/routes.js";
import userRoutes from "../modules/users/routes.js";

// Punto central para registrar módulos y prefijos de la API.
const apiRoutes = Router();

apiRoutes.use("/usuarios", userRoutes);
apiRoutes.use("/mascotas", petRoutes);
apiRoutes.use("/contacto", contactRoutes);
apiRoutes.use("/lugares", placeRoutes);

export default apiRoutes;
