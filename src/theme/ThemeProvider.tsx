import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { nightTokens, type ThemeColor } from "./nightTokens";
import { tokens } from "./tokens";

export type Theme = {
  dark: boolean;
  color: ThemeColor;
};

const lightTheme: Theme = { color: tokens.color, dark: false };

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const user = useQuery(api.users.current);
  const dark = user?.darkMode ?? false;

  const value = useMemo<Theme>(
    () => ({ color: dark ? nightTokens.color : tokens.color, dark }),
    [dark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
