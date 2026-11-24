import express from "express";
import { fileURLToPath } from "node:url";
import apiRoutes from "./index/api.js";

const app = express();
const frontendDirectory = fileURLToPath(
  new URL("../../frontend/src/", import.meta.url),
);
const helpPage = fileURLToPath(
  new URL("../../frontend/src/ayuda.html", import.meta.url),
);
const uploadsDirectory = fileURLToPath(
  new URL("../../data/uploads/", import.meta.url),
);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(frontendDirectory));
app.use("/uploads", express.static(uploadsDirectory, { maxAge: "1d" }));

// Rutas de estado y ayuda para comprobar el servicio y consultar la API.
app.get("/ayuda", (_req, res) => res.sendFile(helpPage));
app.get("/estado", (_req, res) =>
  res.json({ estado: "disponible", bases: ["SQL", "NoSQL documental"] }),
);

// El registro central mantiene juntas las rutas API y sus prefijos.
app.use(apiRoutes);

// Permite abrir o recargar cualquier pantalla de la aplicación web.
app.get(/^\/app(?:\/.*)?$/, (_req, res) => {
  res.sendFile(
    fileURLToPath(new URL("../../frontend/src/index.html", import.meta.url)),
  );
});

app.use((_req, res) => {
  res
    .status(404)
    .json({ mensaje: "Ruta no encontrada. Consulta la guía en /ayuda." });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError || error.type === "entity.parse.failed") {
    return res.status(400).json({ mensaje: "El JSON enviado no es válido." });
  }
  if (error.status === 413 || error.type === "entity.too.large") {
    return res
      .status(413)
      .json({ mensaje: "El cuerpo de la solicitud supera el máximo de 1 MB." });
  }
  console.error(error);
  res.status(500).json({ mensaje: "Ocurrió un error en el servidor." });
});

export default app;
