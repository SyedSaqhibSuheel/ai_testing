import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Boxes, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState, ErrorState, Monogram, PageBody, PageHeader, PageShell, Surface } from "@/components/workspace/kit";

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

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
    <PageShell>
      <PageHeader trail={["Test design", "Test case management"]} title="Test Case Management" subtitle="Organize test cases by application. Select an application to view its test cases and execution history." />

      <PageBody>
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Surface key={i} className="h-44 animate-pulse p-6">
                <div className="h-10 w-10 rounded-lg bg-panel-2" />
                <div className="mt-5 h-3.5 w-1/2 rounded bg-panel-2" />
                <div className="mt-2 h-3 w-3/4 rounded bg-panel-2" />
              </Surface>
            ))}
          </div>
        )}

        {error && <ErrorState>Failed to load applications.</ErrorState>}

        {!isLoading && !error && applications?.length === 0 && (
          <Surface>
            <EmptyState icon={Boxes} title="No applications yet" description="No applications have been created yet." />
          </Surface>
        )}

        {!isLoading && !error && applications && applications.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {orderedApplications.map((application) => {
              const host = hostOf(application.appBaseUrl);
              return (
                <Link
                  key={application.id}
                  to={`/test-case-management/${application.id}`}
                  className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Surface interactive className="flex h-full flex-col">
                    <div className="flex-1 p-6">
                      <Monogram name={application.name} />
                      <h3 className="mt-5 truncate text-base font-semibold tracking-tight text-text">{application.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{application.description || "No description provided."}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-muted">
                        <Globe className="h-4 w-4 shrink-0" />
                        <span className="truncate">{host ?? "No base URL set"}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-muted transition-colors group-hover:text-primary">
                        Open
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Surface>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </PageShell>
  );
}
