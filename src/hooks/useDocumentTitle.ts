import { useEffect } from "react";

export function useDocumentTitle(title: string, suffix = "Nevorai Flow") {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${suffix}` : suffix;
    return () => {
      document.title = previous;
    };
  }, [title, suffix]);
}
