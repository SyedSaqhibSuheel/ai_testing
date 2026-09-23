import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";

export function TestCaseManagement() {
  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["applications"],
    queryFn: api.listApplications,
  });
  const orderedApplications = [...(applications ?? [])].sort((a, b) => {
  const order: Record<string, number> = {
    Flipkart: 1,
    "Call Centre": 2,
    Other: 3,
  };

  return (order[a.name] ?? 99) - (order[b.name] ?? 99);
});

  return (
    <div>
      <PageHeader
        title="Test Case Management"
        subtitle="Organize test cases by application"
      />

      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Applications</h2>
          <p className="text-sm text-muted mt-1">
            Select an application to view its test cases and execution history.
          </p>
        </div>

        {isLoading && (
          <div className="text-sm text-muted">
            Loading applications...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400">
            Failed to load applications.
          </div>
        )}

        {!isLoading && !error && applications?.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              No applications have been created yet.
            </p>
          </Card>
        )}

        {!isLoading && !error && applications && applications.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
           {orderedApplications.map((application) => (
              <Link
                key={application.id}
                to={`/test-case-management/${application.id}`}
              >
                <Card className="p-5 h-full hover:border-accent transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel-2 text-lg">
                      📁
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-semibold">
                        {application.name}
                      </h3>

                      {application.description && (
                        <p className="text-sm text-muted mt-1">
                          {application.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}