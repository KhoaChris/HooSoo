import { useEffect, useState } from "react";

// Keep text input immediate while sending only the settled search to the API.
export function useDebouncedValue<T>(value: T, delay = 350) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
