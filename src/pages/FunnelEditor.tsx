// FunnelEditor — placeholder. The full 1429-line wizard from nFlow will
// be ported in the next pass. This stub lets routing build.
import { Link, useParams } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";

const FunnelEditor = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <h1 className="text-2xl font-heading font-bold">{isEdit ? "Edit Funnel" : "Create Funnel"}</h1>
        <p className="text-sm text-muted-foreground">
          The full funnel wizard (1400+ lines) is being ported in the next pass. The list, detail view, and viewer routes are wired up.
        </p>
        <Link to="/funnels"><Button variant="outline">← Back to Funnels</Button></Link>
      </div>
    </DashboardLayout>
  );
};

export default FunnelEditor;
