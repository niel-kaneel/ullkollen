import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff, Share, X } from "lucide-react";

const IOS_PROMPT_KEY = "ullkollen.iosInstallDismissed";

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isPreviewHost() {
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com") || h === "localhost";
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function PWALifecycle() {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  // Online/offline banner
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Service worker registration — guarded against editor preview / iframes
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (isPreviewHost() || isInIframe()) {
      // Clean up any SW that may have been registered previously in preview
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const promptUpdate = (worker: ServiceWorker) => {
          toast("Ny version tillgänglig", {
            description: "Ladda om för att uppdatera Ullkollen.",
            duration: Infinity,
            action: {
              label: "Uppdatera",
              onClick: () => worker.postMessage("SKIP_WAITING"),
            },
          });
        };

        if (registration.waiting) promptUpdate(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(installing);
            }
          });
        });

        // Check for updates periodically
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => console.warn("SW registration failed", err));
  }, []);

  // iOS install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewHost() || isInIframe()) return;
    if (!isIosSafari() || isStandalone()) return;
    if (localStorage.getItem(IOS_PROMPT_KEY)) return;
    const t = setTimeout(() => setShowIosPrompt(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const dismissIos = () => {
    localStorage.setItem(IOS_PROMPT_KEY, "1");
    setShowIosPrompt(false);
  };

  return (
    <>

      {showIosPrompt && (
        <div className="fixed bottom-4 inset-x-4 z-[60] max-w-md mx-auto rounded-2xl bg-card border border-border shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-foreground">Installera Ullkollen</h3>
                <button
                  onClick={dismissIos}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Stäng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tryck på <Share className="inline h-3.5 w-3.5 mx-0.5 -mt-0.5" />
                Dela-ikonen i Safari och välj <strong>"Lägg till på hemskärmen"</strong> för
                att använda Ullkollen som en app.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
