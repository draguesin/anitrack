import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";

/**
 * Gesto de deslizar a izquierda/derecha para cambiar de categoría.
 * Solo se activa si el movimiento es claramente horizontal, así el scroll
 * vertical de las listas y las filas horizontales (chips) siguen funcionando.
 * Uso: <View style={{ flex: 1 }} {...swipe}> ... </View>
 */
export function useSwipe(onNext: () => void, onPrev: () => void, enabled: boolean = true) {
  const ref = useRef({ onNext, onPrev, enabled });
  ref.current = { onNext, onPrev, enabled };

  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e: any, g: any) =>
          ref.current.enabled &&
          Math.abs(g.dx) > 20 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_e: any, g: any) => {
          if (g.dx <= -60) ref.current.onNext(); // desliza a la izquierda → siguiente
          else if (g.dx >= 60) ref.current.onPrev(); // desliza a la derecha → anterior
        },
      }).panHandlers,
    []
  );
}
