import { Directory, File, Paths } from "expo-file-system";

import type { TextFileStore } from "./fileStore";

/**
 * `TextFileStore` en la carpeta de documentos de la app (`offline/…`). No es
 * caché: iOS y Android no la borran solos cuando falta espacio, así la Biblia
 * descargada y la cola sin conexión sobreviven a un reinicio.
 */
const ROOT = "offline";

function fileAt(path: string): File {
  return new File(Paths.document, ROOT, ...path.split("/"));
}

function ensureParent(file: File) {
  const parent = file.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
}

export const deviceFileStore: TextFileStore = {
  read: async (path) => {
    const file = fileAt(path);
    return file.exists ? await file.text() : null;
  },
  write: async (path, text) => {
    const file = fileAt(path);
    ensureParent(file);
    // Se escribe a un temporal y se mueve: si la app se cierra a mitad de un
    // libro, no queda un JSON cortado con el nombre bueno.
    const temp = new File(file.parentDirectory, `${file.name}.tmp`);
    if (temp.exists) temp.delete();
    temp.create();
    temp.write(text);
    if (file.exists) file.delete();
    await temp.move(file);
  },
  remove: async (path) => {
    const file = fileAt(path);
    if (file.exists) file.delete();
  },
  removeTree: async (prefix) => {
    const dir = new Directory(Paths.document, ROOT, ...prefix.split("/").filter(Boolean));
    if (dir.exists) dir.delete();
  },
};
