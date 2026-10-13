import { defineComponent } from "convex/server";

// Kit de admin (#235). Componente local: tablas propias, aisladas de las de la
// app. Regla de frontera: nada en esta carpeta importa de fuera de ella; lo
// específico de Bible AI entra por argumentos. Así, cuando llegue la segunda
// app, sacarlo a luiscf1226/lcf-admin es mover la carpeta (lcf-admin#2).
export default defineComponent("adminKit");
