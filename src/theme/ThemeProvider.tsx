import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { CurrentSeason } from "../../convex/seasons";
import { hondurasToday } from "../features/widget/verseWidget";
import { resolvePalette } from "./seasonPalette";
import { tokens, type ThemeColor } from "./tokens";

export type Theme = {
  dark: boolean;
  color: ThemeColor;
  /**
   * Temporada activa (#199) o null. Mientras carga también es null: la app
   * arranca como siempre y la temporada entra encima cuando llega.
   */
  season: CurrentSeason | null;
};

const lightTheme: Theme = { color: tokens.color, dark: false, season: null };

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const user = useQuery(api.users.current);
  const dark = user?.darkMode ?? false;
  // Con el día del cliente, igual que el devocional: al cambiar el día la
  // query se vuelve a pedir sola.
  const season = useQuery(api.seasons.current, { date: hondurasToday() }) ?? null;
  const paletteKey = season?.paletteKey ?? null;

  const value = useMemo<Theme>(
    () => ({ color: resolvePalette({ dark, paletteKey }), dark, season }),
    [dark, paletteKey, season],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
