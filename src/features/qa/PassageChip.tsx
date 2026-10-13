import { Chip } from "../../components/Chip";
import type { PassageQuery } from "../reading/bookSearch";
import { passageChipLabel } from "./suggestions";

type PassageChipProps = {
  passage: PassageQuery | null;
  onOpen: () => void;
  onClear: () => void;
};

/**
 * Chip de contexto encima del campo (design/oleada-ux.md §U6): pill con borde
 * `borderStrong`, ícono `book` y "Elegir pasaje (opcional)" o "Juan 3" + ✕.
 * El pasaje es opcional: se pregunta primero y se elige después. Desde #232
 * es el `Chip` compartido (el mismo de las notas de prédica).
 */
export function PassageChip({ onClear, onOpen, passage }: PassageChipProps) {
  const label = passageChipLabel(passage);
  return (
    <Chip
      accessibilityHint="Abre el buscador de pasajes."
      accessibilityLabel={passage ? `Pasaje: ${label}. Cambiar` : "Elegir pasaje, opcional"}
      clearLabel={`Quitar ${label}`}
      icon="book"
      iconActive={passage !== null}
      label={label}
      onClear={passage ? onClear : undefined}
      onPress={onOpen}
      testID="qa-passage-chip"
    />
  );
}
