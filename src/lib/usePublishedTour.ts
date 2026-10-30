import { useEffect, useState } from "react";
import { getPublicTour, getPublicVersion } from "./api";
type PublicTour = NonNullable<Awaited<ReturnType<typeof getPublicTour>>>;

// Existing tabs and embedded tours see new publications without a manual reload.
export function usePublishedTour(initial: PublicTour) {
  const [tour, setTour] = useState(initial);
  useEffect(() => {
    setTour(initial);
    let alive = true;
    let pending = false;
    let version = initial.version_id;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const latest = await getPublicVersion(initial.slug);
        if (latest && latest !== version) {
          const next = await getPublicTour(initial.slug);
          if (alive && next) {
            version = next.version_id;
            setTour(next);
          }
        }
      } catch { /* Keep the current tour during a transient network failure. */ }
      finally { pending = false; }
    }
    const interval = window.setInterval(() => void refresh(), 30000);
    const onReturn = () => void refresh();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    void refresh();
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [initial]);
  return tour;
}
