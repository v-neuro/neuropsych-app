import { useEffect, useLayoutEffect, useRef } from "react";

// Classnames joiner
export function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

// Declarative setInterval hook
export function useInterval(cb, delay) {
  const saved = useRef(cb);
  useEffect(() => {
    saved.current = cb;
  }, [cb]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Clock displays need no polling while hidden. On return, sample their timestamp
// immediately rather than waiting for the next (possibly throttled) interval.
export function useClockRefresh(callback, delay) {
  const saved = useRef(callback);
  useLayoutEffect(() => { saved.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    let interval;
    const clear = () => { clearInterval(interval); interval = undefined; };
    const restart = (refresh = true) => {
      clear();
      if (document.visibilityState === "hidden") return;
      if (refresh) saved.current();
      interval = setInterval(() => saved.current(), delay);
    };
    const resume = () => restart();
    restart(false);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("pagehide", clear);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", clear);
    };
  }, [delay]);
}
