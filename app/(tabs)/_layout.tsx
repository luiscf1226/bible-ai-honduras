import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "../../src/components/TabBar";

/**
 * Pestañas de primer nivel (#232): Inicio, Biblia, Conversar (Preguntar,
 * Sentir y Personajes con un selector arriba), Historias y Mi espacio. Lo
 * demás se apila encima desde el `Stack` de `app/_layout.tsx`, sin barra.
 *
 * `backBehavior="history"`: el "atrás" de Android vuelve a la pestaña anterior,
 * no siempre a Inicio.
 */
export default function TabsLayout() {
  return (
    <Tabs backBehavior="history" screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="leer/index" />
      <Tabs.Screen name="preguntar" />
      <Tabs.Screen name="sentir" />
      <Tabs.Screen name="voces" />
      <Tabs.Screen name="historias" />
      <Tabs.Screen name="mi-espacio" />
    </Tabs>
  );
}
