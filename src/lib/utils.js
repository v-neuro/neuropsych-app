import { useEffect, useRef } from "react";

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
