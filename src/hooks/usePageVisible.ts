import { useEffect, useState } from "react";

/** Returns true while the document is visible. Used to pause polling when the tab is hidden. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}
