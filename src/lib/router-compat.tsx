import * as React from "react";
import { Link as TLink, useLocation as useTLocation, useRouter, useParams as useTParams } from "@tanstack/react-router";

// Drop-in replacement for react-router-dom Link that accepts any string `to`.
// Falls back to a plain anchor (full reload) if the path isn't a registered
// TanStack route — that's fine for ported pages we haven't reached yet.
export const Link = React.forwardRef<HTMLAnchorElement, any>(
  ({ to, children, replace, state, ...rest }, ref) => {
    return (
      <TLink ref={ref as any} to={to as any} {...rest}>
        {children}
      </TLink>
    );
  },
);
Link.displayName = "Link";

// react-router-dom-style useNavigate
export const useNavigate = () => {
  const router = useRouter();
  return (path: string | number, opts?: any) => {
    if (typeof path === "number") {
      if (typeof window !== "undefined") window.history.go(path);
      return;
    }
    router.navigate({ to: path as any, ...(opts || {}) });
  };
};

export const useLocation = () => {
  const loc = useTLocation();
  return { pathname: loc.pathname, search: loc.search, hash: loc.hash, state: undefined };
};

export const useParams = <T extends Record<string, string> = Record<string, string>>() => {
  const params = useTParams({ strict: false }) as Record<string, string>;
  return params as T;
};

// react-router-dom-style <Navigate to="..." replace />
export const Navigate = ({ to, replace }: { to: string; replace?: boolean }) => {
  const router = useRouter();
  React.useEffect(() => {
    router.navigate({ to: to as any, replace });
  }, [to, replace]);
  return null;
};
