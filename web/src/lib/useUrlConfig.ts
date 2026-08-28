/**
 * React Hook for URL Configuration Management
 * Manages environment profiles and URL resolution
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EnvironmentProfile } from "../types";

export interface URLConfigState {
  activeProfileId: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  allProfiles: EnvironmentProfile[];
}

/**
 * Hook to fetch and manage the active URL configuration
 */
export function useUrlConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["url-config-active"],
    queryFn: async () => {
      const res = await fetch("/api/url-config/active");
      if (!res.ok) throw new Error("Failed to fetch URL config");
      return res.json() as Promise<URLConfigState>;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const switchProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/url-config/profiles/${profileId}/switch`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to switch profile");
      return res.json() as Promise<URLConfigState>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["url-config-active"], data);
    },
  });

  return {
    config,
    isLoading,
    error: error instanceof Error ? error.message : undefined,
    switchProfile: switchProfileMutation.mutate,
    isSwitching: switchProfileMutation.isPending,
  };
}

/**
 * Hook to fetch all available URL profiles
 */
export function useUrlProfiles() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["url-profiles"],
    queryFn: async () => {
      const res = await fetch("/api/url-config/profiles");
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const { profiles } = await res.json();
      return profiles as EnvironmentProfile[];
    },
  });

  return {
    profiles: data || [],
    isLoading,
    error: error instanceof Error ? error.message : undefined,
  };
}

/**
 * Hook to create or update a URL profile
 */
export function useCreateUrlProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: EnvironmentProfile) => {
      const res = await fetch("/api/url-config/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create profile");
      }
      return res.json() as Promise<EnvironmentProfile>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["url-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["url-config-active"] });
    },
  });
}

/**
 * Hook to delete a URL profile
 */
export function useDeleteUrlProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/url-config/profiles/${profileId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete profile");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["url-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["url-config-active"] });
    },
  });
}

/**
 * Hook to test connectivity to active URLs
 */
export function useTestUrlConnectivity() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/url-config/test-connectivity");
      if (!res.ok) throw new Error("Failed to test connectivity");
      return res.json();
    },
  });
}

/**
 * Utility function to resolve an API endpoint using the active configuration
 */
export async function resolveApiUrl(endpoint: string): Promise<string> {
  const res = await fetch("/api/url-config/resolve-api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error("Failed to resolve API URL");
  const { resolvedUrl } = await res.json();
  return resolvedUrl;
}

/**
 * Utility function to resolve an app endpoint using the active configuration
 */
export async function resolveAppUrl(endpoint: string): Promise<string> {
  const res = await fetch("/api/url-config/resolve-app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error("Failed to resolve app URL");
  const { resolvedUrl } = await res.json();
  return resolvedUrl;
}
