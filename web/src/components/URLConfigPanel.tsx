/**
 * URL Configuration Panel Component
 * Simplified version - enter URLs and add them to the list
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, ChevronDown, Globe, LoaderCircle, Plus, Wifi, XCircle } from "lucide-react";
import { Btn, Chip, TextAction, cx, inputClass } from "@/components/workspace/kit";
import { validateURL, testURLConnectivity, formatErrorMessage } from "@/lib/urlValidator";

interface URLConfig {
  activeProfileId: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  allProfiles: Array<{
    id: string;
    name: string;
    appBaseUrl: string;
    apiBaseUrl: string;
    description?: string;
  }>;
}

interface FormErrors {
  url?: string;
  name?: string;
}

interface ConnectivityStatus {
  isReachable: boolean;
  message: string;
  statusCode?: number;
  responseTime?: number;
}

export function URLConfigPanel() {
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus | null>(null);
  const [isTestingUrl, setIsTestingUrl] = useState(false);

  // Fetch active config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["url-config-active"],
    queryFn: async () => {
      const res = await fetch("/api/url-config/active");
      if (!res.ok) throw new Error("Failed to fetch URL config");
      return (await res.json()) as URLConfig;
    },
    refetchInterval: 30000,
  });

  // Fetch profiles
  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: ["url-profiles"],
    queryFn: async () => {
      const res = await fetch("/api/url-config/profiles");
      if (!res.ok) throw new Error("Failed to fetch profiles");
      return (await res.json()) as { profiles: URLConfig["allProfiles"] };
    },
  });

  const profiles = profilesData?.profiles || [];

  // Switch profile mutation
  const switchProfile = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/url-config/profiles/${profileId}/switch`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to switch profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["url-config-active"] });
    },
  });

  // Create profile mutation
  const createProfile = useMutation({
    mutationFn: async (profile: {
      id: string;
      name: string;
      appBaseUrl: string;
      apiBaseUrl: string;
    }) => {
      const res = await fetch("/api/url-config/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["url-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["url-config-active"] });
      // Form is already cleared in handleAddUrl, but double-check here
      setUrlInput("");
      setNameInput("");
      setFormErrors({});
      setConnectivityStatus(null);
      setIsTestingUrl(false);
    },
    onError: (error) => {
      alert(`Failed to add URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  // Test URL connectivity
  const testUrlConnectivity = async (url: string): Promise<ConnectivityStatus> => {
    try {
      const result = await testURLConnectivity(url);

      // Handle response format - could be error, or app/api results
      if ('error' in result && result.error) {
        return {
          isReachable: false,
          message: result.error,
        };
      }

      // If we have app result, use that
      if (result.app) {
        return {
          isReachable: result.app.isReachable,
          message: result.app.message || (result.app.isReachable ? '✓ Reachable' : '✗ Unreachable'),
          statusCode: result.app.statusCode,
          responseTime: result.app.responseTime,
        };
      }

      // Default to unreachable if no result
      return {
        isReachable: false,
        message: 'No response from server',
      };
    } catch (error) {
      return {
        isReachable: false,
        message: formatErrorMessage(error instanceof Error ? error : new Error(String(error))),
      };
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!urlInput.trim()) {
      errors.url = "URL is required";
    } else {
      const validation = validateURL(urlInput);
      if (!validation.isValid) {
        errors.url = validation.errors[0];
      }
    }

    if (!nameInput.trim()) {
      errors.name = "Name is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTestUrl = async () => {
    if (!validateForm()) return;

    setIsTestingUrl(true);
    try {
      const result = await testUrlConnectivity(urlInput);
      setConnectivityStatus(result);
    } catch (error) {
      setConnectivityStatus({
        isReachable: false,
        message: formatErrorMessage(error instanceof Error ? error : new Error(String(error))),
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleAddUrl = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Generate a profile ID from the name (lowercase, replace spaces with hyphens)
    const profileId = nameInput
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // Capture values before clearing
    const urlToadd = urlInput;
    const nameToAdd = nameInput;

    // Clear form immediately for better UX
    setUrlInput("");
    setNameInput("");
    setFormErrors({});
    setConnectivityStatus(null); // Clear connectivity status
    setIsTestingUrl(false); // Reset testing flag

    // Then submit with captured values
    createProfile.mutate({
      id: profileId,
      name: nameToAdd,
      appBaseUrl: urlToadd,
      apiBaseUrl: urlToadd,
    });
  };

  const isLoading = configLoading || profilesLoading;

  if (isLoading) {
    return <div className="text-sm text-muted">Loading URL configuration...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Add New URL */}
      <div>
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">Add New URL</h3>
        <form onSubmit={handleAddUrl} className="space-y-4">
          <div>
            <label htmlFor="url-input" className="mb-2 block text-sm font-medium text-text">
              Website URL
            </label>
            <input
              id="url-input"
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (formErrors.url) setFormErrors({ ...formErrors, url: undefined });
              }}
              placeholder="e.g., https://app.example.com"
              className={cx(inputClass, formErrors.url && "border-fail focus:border-fail focus:ring-fail/15")}
            />
            {formErrors.url && <p className="mt-1.5 text-xs text-fail">{formErrors.url}</p>}
          </div>

          <div>
            <label htmlFor="name-input" className="mb-2 block text-sm font-medium text-text">
              Display Name
            </label>
            <input
              id="name-input"
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
              }}
              placeholder="e.g., Fidar Call Center"
              className={cx(inputClass, formErrors.name && "border-fail focus:border-fail focus:ring-fail/15")}
            />
            {formErrors.name && <p className="mt-1.5 text-xs text-fail">{formErrors.name}</p>}
          </div>

          {/* Test URL Button - Optional */}
          <details className="group rounded-xl border border-border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-muted transition-colors hover:text-text">
              <Wifi className="h-4 w-4" />
              Optional: test connectivity before adding
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-border px-4 py-4">
              <Btn onClick={handleTestUrl} disabled={isTestingUrl || !urlInput.trim()} className="w-full" icon={isTestingUrl ? LoaderCircle : Wifi} iconClassName={isTestingUrl ? "animate-spin" : undefined}>
                {isTestingUrl ? "Testing..." : "Test Connectivity"}
              </Btn>

              {connectivityStatus && (
                <div
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
                    connectivityStatus.isReachable ? "border-pass/20 bg-pass/5" : "border-fail/20 bg-fail/5",
                  )}
                >
                  <span className={cx("inline-flex items-center gap-1.5 font-medium", connectivityStatus.isReachable ? "text-pass" : "text-fail")}>
                    {connectivityStatus.isReachable ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {connectivityStatus.isReachable ? "Reachable" : "Unreachable"}
                  </span>
                  {connectivityStatus.statusCode && (
                    <span className="text-xs text-muted tabular-nums">
                      Status: {connectivityStatus.statusCode}
                      {connectivityStatus.responseTime && ` (${connectivityStatus.responseTime}ms)`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </details>

          <Btn type="submit" variant="primary" disabled={createProfile.isPending} className="w-full" icon={Plus}>
            {createProfile.isPending ? "Adding..." : "Add URL"}
          </Btn>
        </form>
      </div>

      <div className="space-y-6">
        {/* Current Configuration */}
        {config && (
          <div>
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">Active Configuration</h3>
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-text">{config.activeProfileId}</div>
                <div className="mono mt-0.5 break-all text-xs text-muted">{config.appBaseUrl}</div>
              </div>
            </div>
          </div>
        )}

        {/* URL List */}
        {profiles.length > 0 && (
          <div>
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">Available URLs</h3>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {profiles.map((profile) => {
                const isActive = config?.activeProfileId === profile.id;
                return (
                  <li key={profile.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-panel-2/40">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">{profile.name}</div>
                      <div className="mono mt-0.5 break-all text-xs text-muted">{profile.appBaseUrl}</div>
                    </div>
                    {isActive ? (
                      <Chip tone="pass" icon={Check}>
                        Active
                      </Chip>
                    ) : (
                      <TextAction tone="primary" onClick={() => switchProfile.mutate(profile.id)} disabled={switchProfile.isPending}>
                        Switch
                      </TextAction>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
