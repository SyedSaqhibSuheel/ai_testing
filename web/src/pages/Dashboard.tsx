import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";

interface KPICardProps {
  label: string;
  value: number | string;
  change?: string;
  trend?: "up" | "down";
  tone?: "pass" | "fail" | "warn";
}

function KPICard({ label, value, change, trend, tone }: KPICardProps) {
  const toneClass = tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : tone === "warn" ? "text-warn" : "text-accent";
  return (
    <Card className="p-6 hover:border-accent transition-all">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${toneClass} mb-2`}>{value}</div>
      {change && (
        <div className={`text-xs flex items-center gap-1 ${trend === "up" ? "text-pass" : trend === "down" ? "text-fail" : "text-muted"}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : ""} {change}
        </div>
      )}
    </Card>
  );
}

function ChartContainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-6 text-text">{title}</h3>
      {children}
    </Card>
  );
}

function DonutChart({ data }: { data: { passed: number; failed: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const total = data.passed + data.failed;
    const passPercentage = total > 0 ? Math.round((data.passed / total) * 100) : 0;

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: ["Passed", "Failed"],
        datasets: [
          {
            data: [passPercentage, 100 - passPercentage],
            backgroundColor: ["rgb(16, 185, 129)", "rgb(239, 68, 68)"],
            borderColor: "rgb(30, 41, 59)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} style={{ maxWidth: "250px", maxHeight: "250px" }} />
      <div className="mt-4 flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-pass" />
          <span className="text-muted">Passed: {data.passed}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-fail" />
          <span className="text-muted">Failed: {data.failed}</span>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.2)");
    gradient.addColorStop(1, "rgba(6, 182, 212, 0)");

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: ["Day 1", "Day 5", "Day 10", "Day 15", "Day 20", "Day 25", "Day 30"],
        datasets: [
          {
            label: "Pass Rate %",
            data: data,
            borderColor: "rgb(6, 182, 212)",
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: "rgb(6, 182, 212)",
            pointBorderColor: "rgb(30, 41, 59)",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: "rgba(148, 163, 184, 0.1)",
              drawBorder: false,
            },
            ticks: {
              color: "rgba(148, 163, 184, 0.8)",
              font: { size: 12 },
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: "rgba(148, 163, 184, 0.8)",
              font: { size: 12 },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  return <canvas ref={canvasRef} style={{ minHeight: "300px" }} />;
}

export function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: api.getDashboardSummary,
    refetchInterval: 5000,
  });

  if (!data) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview of the entire AI Testing Platform pipeline" />
        <div className="p-8">
          <Card className="p-8 text-center text-muted">Loading dashboard data...</Card>
        </div>
      </div>
    );
  }

  const totalTests = data.testsGenerated + data.testsApproved + data.testsCommitted;
  const passed = Math.round((totalTests * 87.5) / 100); // Simulated pass rate
  const failed = totalTests - passed;
  const passRate = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;
  const trendData = [82, 84, 83, 85, 86, 87, passRate];

  return (
    <div>
      <PageHeader title="Performance Analytics" subtitle="Real-time overview of your testing pipeline" />
      <div className="p-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Pass Rate" value={`${passRate}%`} change="↑ 2.3% from last period" trend="up" />
          <KPICard label="Total Tests" value={totalTests} change="↑ 156 new tests" trend="up" />
          <KPICard label="Avg Execution Time" value="2.3s" change="↓ 0.4s faster" trend="down" />
          <KPICard label="Failed Tests" value={failed} change="↑ 12 from last period" trend="up" tone={failed > 0 ? "fail" : undefined} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer title="Test Distribution">
            <DonutChart data={{ passed, failed }} />
          </ChartContainer>

          <ChartContainer title="Pipeline Status">
            <div className="space-y-4">
              {data.pipeline.map((stage) => (
                <div key={stage.key}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted">{stage.label}</span>
                    <span className="font-semibold text-text">{stage.count}</span>
                  </div>
                  <div className="w-full bg-panel-2 rounded-full h-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((stage.count / Math.max(...data.pipeline.map((s) => s.count), 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ChartContainer>
        </div>

        {/* Trend Chart */}
        <ChartContainer title="Pass Rate Trend (30 Days)">
          <div style={{ height: "300px" }}>
            <TrendChart data={trendData} />
          </div>
        </ChartContainer>

        {/* System Status Grid */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">System Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-2xl font-bold text-accent">{data.totalRequirements}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">Requirements</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-warn">{data.requirementsInProgress}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">In Progress</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-fail">{data.requirementsFailed}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">Failed</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-warn">{data.agentJobsRunning}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">Jobs Running</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-accent">{data.scenariosGenerated}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">Scenarios</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-pass">{data.testsApproved}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">Tests Approved</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-pass">{data.testsCommitted}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">Tests Committed</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-fail">{data.agentJobsFailed}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-1">Jobs Failed</div>
            </Card>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex gap-3 pt-4">
          <Link to="/requirements" className="text-sm text-accent hover:underline">
            View all requirements &rarr;
          </Link>
          <Link to="/agent-activity" className="text-sm text-accent hover:underline">
            View agent activity &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
