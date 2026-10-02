import { router } from "expo-router";
import type { ReactNode } from "react";

import { FullScreenNotice } from "../../components/FullScreenNotice";
import { isBibleComplete } from "./bibleDownload";
import { useOfflineBible } from "./offlineBible";
import { offlineModuleCopy, type OnlineOnlyModule } from "./offlineCopy";
import { useIsOnline } from "./useIsOnline";

/**
 * Preguntar, Voces, Sentir e Historias necesitan red (#160): sin señal, en vez
 * de quedarse cargando para siempre, se dice por qué y se ofrece ir a leer.
 * Es `FullScreenNotice` (el mismo layout de "Por hoy llegaste al límite") con
 * otro texto: cero tokens ni patrones nuevos.
 */
export function RequiresConnection({ children, module }: { children: ReactNode; module: OnlineOnlyModule }) {
  const online = useIsOnline();
  const { index } = useOfflineBible();
  if (online) return <>{children}</>;
  const copy = offlineModuleCopy(module, isBibleComplete(index));
  return (
    <FullScreenNotice
      body={copy.body}
      cta={copy.cta}
      mark="⌁"
      onCta={() => router.replace("/leer")}
      testID={`offline-${module}`}
      title={copy.title}
    />
  );
}
