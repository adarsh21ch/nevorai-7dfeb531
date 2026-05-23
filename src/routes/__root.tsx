import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: "Nevorai — Built for Creators who Sell" },
      { name: "description", content: "The smarter way to share business videos. Know exactly who watched, when, and how much. Nevorai." },
      { name: "author", content: "Nevorai" },
      { name: "keywords", content: "Nevorai, business video, unskippable video, video sharing, video tracking, see who watched" },
      { property: "og:title", content: "Nevorai — Built for Creators who Sell" },
      { property: "og:description", content: "The smarter way to share business videos. Know exactly who watched, when, and how much. Nevorai." },
      { property: "og:site_name", content: "Nevorai" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nevorai.com" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Nevorai — Built for Creators who Sell" },
      { name: "twitter:description", content: "The smarter way to share business videos. Know exactly who watched, when, and how much. Nevorai." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/26485bde-6bad-4cd6-aa27-df4d7ed62730" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/26485bde-6bad-4cd6-aa27-df4d7ed62730" },
      { name: "theme-color", content: "#ffffff" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Nevorai" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "Nevorai" },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192x192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512x512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1293470716241461');fbq('track','PageView');`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1293470716241461&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Force-unregister stale Service Workers from a previous app version.
  // Old SWs intercept navigation and serve a cached shell that doesn't know
  // about new routes (/f/$slug, /v/$id, etc.) → 404 for returning users.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Silently unregister any leftover SWs and clear their caches.
    // The kill-switch SWs in public/sw.js self-unregister anyway; avoid a
    // hard reload that adds ~1s to every returning user's cold start.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length === 0) return;
      Promise.all(registrations.map((r) => r.unregister()))
        .then(() => {
          if ("caches" in window) {
            return caches.keys().then((keys) =>
              Promise.all(keys.map((k) => caches.delete(k)))
            );
          }
        })
        .catch(() => {});
    }).catch(() => {});
  }, []);

  // Recover from stale chunk / dynamic-import failures (common cause of blank
  // pages after a new deploy): auto-reload once when the browser fails to
  // fetch a code-split chunk. Guarded with sessionStorage so we don't loop.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const RELOAD_KEY = "__chunk_reload_attempt__";

    const isChunkError = (msg: unknown): boolean => {
      const text = typeof msg === "string" ? msg : (msg as any)?.message || "";
      return (
        /Failed to fetch dynamically imported module/i.test(text) ||
        /Importing a module script failed/i.test(text) ||
        /ChunkLoadError/i.test(text) ||
        /Loading chunk \d+ failed/i.test(text) ||
        /error loading dynamically imported module/i.test(text)
      );
    };

    const tryReload = () => {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.message) || isChunkError(e.error)) tryReload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) tryReload();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Clear the guard once a healthy render lands.
    const t = window.setTimeout(() => sessionStorage.removeItem(RELOAD_KEY), 4000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(t);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <CurrencyProvider>
            <ConfirmDialogProvider>
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
              <Toaster />
            </ConfirmDialogProvider>
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
