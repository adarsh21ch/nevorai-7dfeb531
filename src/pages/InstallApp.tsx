import { useState, useEffect } from "react";
import { Logo } from "@/components/landing/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Smartphone, Share, Plus, Check, ArrowLeft } from "lucide-react";
import { Link } from "@/lib/router-compat";

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  if (isStandalone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-md w-full space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Check size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">You're using the app!</h1>
           <p className="text-sm text-muted-foreground">nFlow by Nevorai is already installed on your device.</p>
          <Link to="/dashboard"><Button className="w-full">Go to Dashboard</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></Link>
        <Logo size="sm" />
      </header>

      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto shadow-lg">
            <img src="/icons/icon-512x512.png" alt="nFlow by Nevorai" className="w-full h-full" />
          </div>
          <h1 className="text-2xl font-bold mt-4">Install nFlow by Nevorai</h1>
          <div className="page-header-accent" />
          <p className="text-muted-foreground text-sm">Get the app on your phone for the best experience — instant access, full screen, no browser bars.</p>
        </div>

        {installed ? (
          <Card className="p-6 text-center space-y-3 border-primary/20">
            <Check size={40} className="text-primary mx-auto" />
            <h2 className="font-semibold">App Installed! 🎉</h2>
            <p className="text-sm text-muted-foreground">You can now find nFlow by Nevorai on your home screen.</p>
          </Card>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} className="w-full" size="lg">
            <Download size={18} className="mr-2" /> Install App
          </Button>
        ) : isIOS ? (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-center">Install on iPhone / iPad</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</div>
                <p className="text-sm">Tap the <Share size={14} className="inline text-primary" /> <strong>Share</strong> button at the bottom of Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                <p className="text-sm">Scroll down and tap <Plus size={14} className="inline text-primary" /> <strong>Add to Home Screen</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">3</div>
                <p className="text-sm">Tap <strong>Add</strong> — done! Open from your home screen.</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-center">Install on Android</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</div>
                <p className="text-sm">Tap the <strong>⋮ menu</strong> (three dots) in Chrome</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                <p className="text-sm">Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">3</div>
                <p className="text-sm">Tap <strong>Install</strong> — that's it!</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Smartphone, text: "Full screen\nexperience" },
            { icon: Download, text: "One-tap\naccess" },
            { icon: Check, text: "Always\nupdated" },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/50">
              <item.icon size={20} className="text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground whitespace-pre-line">{item.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default InstallApp;