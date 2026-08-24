import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AgentRun } from "./types";

/**
 * Subscribes to the server's SSE agent-run stream and invalidates the
 * relevant React Query caches on every event, so every page showing agent
 * status / requirement status / dashboard counts updates live without
 * polling.
 */
export function useAgentRunStream(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource("/api/agent-runs/stream");

    source.onmessage = (event) => {
      let run: AgentRun;
      try {
        run = JSON.parse(event.data);
      } catch {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["agent-runs"] });
      queryClient.invalidateQueries({ queryKey: ["requirement", run.requirementId] });
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["test-files"] });
      queryClient.invalidateQueries({ queryKey: ["test-file-versions"] });
      queryClient.invalidateQueries({ queryKey: ["exploration", run.requirementId] });
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
      queryClient.invalidateQueries({ queryKey: ["git-commits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    };

    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };

    return () => source.close();
  }, [queryClient]);
}
