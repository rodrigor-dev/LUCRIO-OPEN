import { useState, useCallback, useRef } from "react";

export function useDebounceClick(delay: number = 1000) {
  const [isProcessing, setIsProcessing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const execute = useCallback(async (fn: () => Promise<void> | void) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await fn();
    } finally {
      timeoutRef.current = setTimeout(() => setIsProcessing(false), delay);
    }
  }, [isProcessing, delay]);

  return { isProcessing, execute };
}