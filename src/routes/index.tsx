import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/landing/Logo";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gradient-bg-subtle relative">
      <div className="absolute inset-0 animate-grid opacity-30" />
      <div className="relative z-10 text-center space-y-8 max-w-2xl">
        <Logo size="lg" showByline />
        <h1 className="text-4xl md:text-5xl font-bold">
          <span className="gradient-text">nFlow</span> — funnels for network marketers
        </h1>
        <p className="text-muted-foreground">Auth scaffolding ready. Sign in or create an account to test.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/auth"><Button variant="hero" size="lg">Get started</Button></Link>
          <Link to="/auth"><Button variant="outline" size="lg">Sign in</Button></Link>
        </div>
      </div>
    </div>
  );
}
