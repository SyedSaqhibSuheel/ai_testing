import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";

export function ApplicationTestCases() {
 const { id } = useParams<{ id: string }>();
   const queryClient = useQueryClient();
const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
const [runningTestFileId, setRunningTestFileId] = useState<string | null>(null);

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: api.listApplications,
  });

  const application = applications?.find((app) => app.id === id);

  const { data: scenarios, isLoading: scenariosLoading, error } = useQuery({
    queryKey: ["scenarios", "application", id],
    queryFn: () => api.listScenarios({ applicationId: id! }),
    enabled: Boolean(id),
  });

  const {
  data: testRuns,
  isLoading: testRunsLoading,
  error: testRunsError,
} = useQuery({
  queryKey: ["test-runs", "application", id],
  queryFn: () => api.listTestRuns({ applicationId: id! }),
  enabled: Boolean(id),
});

const {
  data: selectedRunDetails,
  isLoading: selectedRunLoading,
} = useQuery({
  queryKey: ["test-run", selectedRunId],
  queryFn: () => api.getTestRun(selectedRunId!),
  enabled: Boolean(selectedRunId),
});

const runsByDate = (testRuns ?? []).reduce<Record<string, typeof testRuns>>(
  (groups, run) => {
    const date = new Date(run.startedAt).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date]!.push(run);
    return groups;
  },
  {},
);

  if (applicationsLoading) {
    return (
      <div>
        <PageHeader
          title="Test Case Management"
          subtitle="Loading application..."
        />
        <div className="p-8 text-sm text-muted">
          Loading...
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div>
        <PageHeader
          title="Application Not Found"
          subtitle="The selected application could not be found."
        />
        <div className="p-8">
          <Link
            to="/test-case-management"
            className="text-sm text-accent hover:underline"
          >
            ← Back to applications
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={application.name}
        subtitle={
          application.description ??
          "Test cases and execution history for this application"
        }
      />

      <div className="p-8 space-y-6">
        <Link
          to="/test-case-management"
          className="text-sm text-muted hover:text-accent"
        >
          ← Back to applications
        </Link>

        <div>
          <h2 className="text-lg font-semibold">Test Cases</h2>
          <p className="text-sm text-muted mt-1">
            Test cases assigned to {application.name}.
          </p>
        </div>

        {scenariosLoading && (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              Loading test cases...
            </p>
          </Card>
        )}

        {error && (
          <Card className="p-6 text-center">
            <p className="text-sm text-red-400">
              Failed to load test cases.
            </p>
          </Card>
        )}

        {!scenariosLoading &&
          !error &&
          scenarios?.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted">
                No test cases have been assigned to this application yet.
              </p>
            </Card>
          )}

        {!scenariosLoading &&
          !error &&
          scenarios &&
          scenarios.length > 0 && (
            <Card className="divide-y divide-border">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="font-medium">
                      {scenario.title}
                    </h3>

                    <p className="text-sm text-muted mt-1">
                      {scenario.description}
                    </p>

                    <div className="text-xs text-muted mt-2">
                      ID: {scenario.id}
                    </div>

                    <div className="text-xs text-muted mt-1">
                      {scenario.priority} priority ·{" "}
                      {scenario.riskLevel} risk
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StatusBadge status={scenario.status} />
                  </div>
                </div>
              ))}
            </Card>
          )}

                  <div>
          <h2 className="text-lg font-semibold">Execution History</h2>
          <p className="text-sm text-muted mt-1">
            Test executions organized by date.
          </p>
        </div>

        {testRunsLoading && (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              Loading execution history...
            </p>
          </Card>
        )}

        {testRunsError && (
          <Card className="p-6 text-center">
            <p className="text-sm text-red-400">
              Failed to load execution history.
            </p>
          </Card>
        )}

        {!testRunsLoading &&
          !testRunsError &&
          testRuns?.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted">
                No test executions have been recorded for this application yet.
              </p>
            </Card>
          )}
        {!testRunsLoading &&
          !testRunsError &&
          Object.keys(runsByDate).length > 0 && (
            <div className="space-y-4">
              {Object.entries(runsByDate).map(([date, runs]) => (
                <Card key={date} className="overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <div>
                      <h3 className="font-semibold">{date}</h3>
                      <p className="text-xs text-muted mt-1">
                        {runs?.length ?? 0} execution
                        {(runs?.length ?? 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {runs?.map((run) => (
                      <div
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                        className="p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:bg-muted/10"
                      >
                        <div>
                          <div className="font-medium">
                            {run.testCases?.[0]?.testTitle ?? "Execution"}
                          </div>

                          {run.testCases?.[0] && (
                            <div className="text-xs text-muted mt-1">
                              Test Case ID: {run.testCases[0].testCaseId}
                            </div>
                          )}

                          <div className="text-xs text-muted mt-1">
                            {new Date(run.startedAt).toLocaleTimeString(
                              "en-IN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>

                          <div className="text-xs text-muted mt-1">
                            Run ID: {run.id}
                          </div>
                        </div>
                        <StatusBadge status={run.status} />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}


  {selectedRunId && (
  <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Execution Details</h2>
                <p className="text-xs text-muted mt-1">
                  Run ID: {selectedRunId}
                </p>
              </div>

              <div className="flex items-center gap-3">
  <button
    type="button"
    onClick={async () => {
      if (!selectedRunDetails?.run.testFileId) return;

      setRunningTestFileId(selectedRunDetails.run.testFileId);

      try {
  await api.runTestFile(selectedRunDetails.run.testFileId);

  await queryClient.invalidateQueries({
    queryKey: ["test-runs", "application", id],
  });
} finally {
  setRunningTestFileId(null);
}
    }}
    disabled={runningTestFileId === selectedRunDetails?.run.testFileId}
    className="text-sm text-accent hover:underline disabled:opacity-50"
  >
    {runningTestFileId === selectedRunDetails?.run.testFileId
      ? "Running..."
      : "Run Again"}
  </button>

  <button
    type="button"
    onClick={() => setSelectedRunId(null)}
    className="text-sm text-muted hover:text-accent"
  >
    Close
  </button>
</div>
 </div>
            {selectedRunLoading && (
              <div className="p-5 text-sm text-muted">
                Loading execution details...
              </div>
            )}

            {!selectedRunLoading && selectedRunDetails && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-muted">Status</div>
                    <div className="mt-1">
                      <StatusBadge status={selectedRunDetails.run.status} />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted">Started</div>
                    <div className="text-sm mt-1">
                      {new Date(
                        selectedRunDetails.run.startedAt,
                      ).toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted">Finished</div>
                    <div className="text-sm mt-1">
                      {selectedRunDetails.run.finishedAt
                        ? new Date(
                            selectedRunDetails.run.finishedAt,
                          ).toLocaleString("en-IN")
                        : "Still running"}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Executed Test Cases</h3>

                 {selectedRunDetails.cases.length === 0 &&
selectedRunDetails.testCases.length === 0 ? (
  <p className="text-sm text-muted">
    No test cases are associated with this execution.
  </p>
) : (
  <div className="divide-y divide-border border border-border rounded-lg">
    {selectedRunDetails.cases.map((testCase) => (
      <div key={testCase.id} className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-medium">
              {testCase.title}
            </div>

            {testCase.suiteTitle && (
              <div className="text-xs text-muted mt-1">
                Suite: {testCase.suiteTitle}
              </div>
            )}

            <div className="text-xs text-muted mt-1">
              Test Case ID: {testCase.id}
            </div>
          </div>

          <StatusBadge status={testCase.status} />
        </div>

        <div className="text-xs text-muted mt-2">
          Duration: {testCase.durationMs} ms
        </div>

        {testCase.errorMessage && (
          <div className="mt-3 rounded-md border border-red-500/30 p-3">
            <div className="text-xs font-medium text-red-400">
              Failure Details
            </div>

            <div className="text-sm mt-1">
              {testCase.errorMessage}
            </div>
          </div>
        )}

        {testCase.classification && (
          <div className="text-xs text-muted mt-2">
            Classification: {testCase.classification}
          </div>
        )}

        {testCase.suggestedFix && (
          <div className="text-xs text-muted mt-2">
            Suggested fix: {testCase.suggestedFix}
          </div>
        )}
      </div>
    ))}

    {selectedRunDetails.cases.length === 0 &&
      selectedRunDetails.testCases.map((testCase) => (
        <div key={testCase.id} className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="font-medium">
                {testCase.title}
              </div>

              <div className="text-xs text-muted mt-1">
                Test Case ID: {testCase.testCaseId}
              </div>

              <div className="text-xs text-muted mt-1">
                Scenario: {testCase.scenarioTitle}
              </div>
            </div>

            <StatusBadge status={selectedRunDetails.run.status} />
          </div>

          {selectedRunDetails.run.errorMessage && (
            <div className="mt-3 rounded-md border border-red-500/30 p-3">
              <div className="text-xs font-medium text-red-400">
                Execution Error
              </div>

              <div className="text-sm mt-1">
                {selectedRunDetails.run.errorMessage}
              </div>
            </div>
          )}

          <div className="text-xs text-muted mt-2">
            This test case was associated with the execution, but Playwright
            did not record an individual test result.
          </div>
        </div>
      ))}
  </div>
)}
                </div>
              </div>
            )}
          </Card>
            )}
      </div>
    </div>
  );
}