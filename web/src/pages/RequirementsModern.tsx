import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Plus, ArrowRight, Clock, User } from "lucide-react";
import { api } from "@/lib/api";
import type { Requirement } from "@/lib/types";
import { CardModern } from "@/components/ui/CardModern";
import { ButtonModern } from "@/components/ui/ButtonModern";
import { BadgeModern } from "@/components/ui/BadgeModern";

function PageHeaderModern({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-800/50 border-b border-slate-700/30 px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-50 mb-2">{title}</h1>
      <p className="text-slate-400">{subtitle}</p>
    </div>
  );
}

export function RequirementsModern() {
  const queryClient = useQueryClient();
  const [newRequirementText, setNewRequirementText] = useState("");

  const { data: requirements = [] } = useQuery({
    queryKey: ["requirements"],
    queryFn: api.listRequirements,
    refetchInterval: 3000,
  });

  const createMutation = useMutation({
    mutationFn: (rawText: string) => api.createRequirement(rawText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      setNewRequirementText("");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newRequirementText.trim()) {
      createMutation.mutate(newRequirementText);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "committed":
        return { status: "success" as const, label: "Committed", dot: true };
      case "awaiting_test_approval":
        return { status: "pending" as const, label: "Awaiting Approval", dot: true };
      case "submitted":
        return { status: "submitted" as const, label: "Submitted", dot: true };
      case "analyzing":
        return { status: "info" as const, label: "Analyzing", dot: true };
      case "planning":
        return { status: "info" as const, label: "Planning", dot: true };
      case "generating_tests":
        return { status: "info" as const, label: "Generating Tests", dot: true };
      case "failed":
        return { status: "critical" as const, label: "Failed", dot: true };
      default:
        return { status: "info" as const, label: status, dot: true };
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <PageHeaderModern
        title="Requirements"
        subtitle="Define test requirements in plain English - the starting point for every pipeline run"
      />

      {/* Main Content */}
      <div className="p-8 space-y-8 max-w-6xl mx-auto">
        {/* New Requirement Section */}
        <CardModern variant="glass" className="p-8">
          <div className="mb-4">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Create New Requirement
            </label>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={newRequirementText}
              onChange={(e) => setNewRequirementText(e.target.value)}
              placeholder='e.g., "An administrator should be able to create a customer. Name and email are mandatory. Duplicate emails must be rejected. Normal users must not be allowed to create customers."'
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-500 resize-none outline-none transition-all duration-200"
              rows={4}
            />

            <div className="flex justify-end gap-3">
              <ButtonModern
                variant="ghost"
                onClick={() => setNewRequirementText("")}
                type="button"
              >
                Clear
              </ButtonModern>
              <ButtonModern
                variant="primary"
                disabled={!newRequirementText.trim() || createMutation.isPending}
                type="submit"
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Submit Requirement
                  </span>
                )}
              </ButtonModern>
            </div>
          </form>
        </CardModern>

        {/* Requirements List */}
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-50 mb-2">
              All Requirements ({requirements.length})
            </h2>
            <p className="text-slate-400 text-sm">
              Click on any requirement to view details and scenarios
            </p>
          </div>

          <div className="space-y-3">
            {requirements.length > 0 ? (
              requirements.map((req: Requirement) => {
                const statusConfig = getStatusConfig(req.status);
                return (
                  <Link key={req.id} to={`/requirements/${req.id}`}>
                    <CardModern
                      variant="glass"
                      interactive
                      className="p-6 group hover:shadow-xl hover:shadow-indigo-500/10"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-100 font-semibold mb-3 line-clamp-2 group-hover:text-indigo-300 transition-colors">
                            {req.title || req.rawText}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <User className="w-4 h-4" />
                              <span>{req.submittedBy || "Unknown"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <BadgeModern
                            status={statusConfig.status}
                            variant="soft"
                            dot={statusConfig.dot}
                          >
                            {statusConfig.label}
                          </BadgeModern>
                          <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>
                    </CardModern>
                  </Link>
                );
              })
            ) : (
              <CardModern variant="ghost" className="p-12 text-center">
                <p className="text-slate-400 mb-4">No requirements yet</p>
                <p className="text-slate-500 text-sm">
                  Create your first requirement above to get started
                </p>
              </CardModern>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
