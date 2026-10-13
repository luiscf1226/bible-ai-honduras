import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Ruta vieja de Preguntar. Desde U6 (#198) el chat es `/preguntar` (hoy, la
 * pestaña Conversar, #232); esta queda como alias para enlaces que ya existan
 * (notificaciones, versiones viejas) y manda a la pestaña con los mismos params.
 */
export default function PreguntarChatAlias() {
  const params = useLocalSearchParams<Record<string, string>>();
  return <Redirect href={{ pathname: "/preguntar", params }} />;
}
