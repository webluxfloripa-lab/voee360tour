import { useEffect, useState } from "react";
import { getPublicTour, getPublicVersion } from "./api";
type PublicTour = NonNullable<Awaited<ReturnType<typeof getPublicTour>>>;

// Signed media links last one hour. Renew before expiry even when the published
// version has not changed, including when a previously hidden tab is revisited.
const mediaRefreshInterval = 45 * 60 * 1000;

// Existing tabs and embedded tours see new publications without a manual reload.
export function usePublishedTour(initial: PublicTour) {
  const [tour, setTour] = useState<PublicTour | null>(initial);
  useEffect(() => {
    setTour(initial);
    let alive = true;
    let pending = false;
    let version: string | undefined = initial.version_id;
    let mediaRefreshedAt = Date.now();
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const latest = await getPublicVersion(initial.slug);
        if (!alive) return;
        if (!latest) {
          version = undefined;
          setTour(null);
          return;
        }
        if (latest !== version || Date.now() - mediaRefreshedAt >= mediaRefreshInterval) {
          const next = await getPublicTour(initial.slug);
          if (!alive) return;
          // The publication can be withdrawn between the version and tour reads.
          if (!next) {
            version = undefined;
            setTour(null);
          } else {
            version = next.version_id;
            mediaRefreshedAt = Date.now();
            // Renewing URLs alone must not reset the panorama or selected scene.
            // Its setup depends on the snapshot and media object identities.
            setTour((current) => current && current.version_id === next.version_id
              ? { ...current, urls: next.urls }
              : next);
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
