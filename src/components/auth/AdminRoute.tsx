import { Navigate, useLocation } from "@/lib/router-compat";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";

/**
 * AdminRoute — guards admin pages with continuous role verification.
 *
 * Security properties:
 * - Fails closed: any loading/error state is treated as "not admin yet"
 * - Continuous re-check via useAdmin (60s interval + on focus/reconnect)
 * - If a logged-in admin is demoted while viewing admin pages, they are
 *   immediately bounced to /dashboard with a notice.
 */
export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useAdmin();
  const location = useLocation();

  // Notify user if they lose admin while viewing an admin page
  useEffect(() => {
    if (!loading && !isLoading && user && !isAdmin) {
      toast({
        title: "Page not found",
        description: "The page you're looking for doesn't exist.",
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, loading, isLoading, user?.id]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
