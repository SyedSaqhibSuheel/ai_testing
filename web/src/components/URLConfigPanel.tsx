/**
 * URL Configuration Panel Component
 * Simplified version - enter URLs and add them to the list
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
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

type UrlProfile = URLConfig["allProfiles"][number];

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
      return res.json();
    },
  });

  const profiles: UrlProfile[] = profilesData?.profiles || [];

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
    <div className="space-y-4">
      {/* Add New URL */}
      <div>
        <h3 className="text-sm font-medium mb-2">Add New URL</h3>
        <Card className="p-4 space-y-3">
          <form onSubmit={handleAddUrl} className="space-y-3">
            <div>
              <label htmlFor="url-input" className="text-xs text-muted block mb-1.5">
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
                placeholder="e.g., https://callcenter.fidar.io"
                className={`w-full bg-panel-2 border rounded px-3 py-2 text-sm transition-colors ${
                  formErrors.url ? "border-red-500" : "border-border"
                }`}
              />
              {formErrors.url && <p className="text-xs text-red-400 mt-1">{formErrors.url}</p>}
            </div>

            <div>
              <label htmlFor="name-input" className="text-xs text-muted block mb-1.5">
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
                className={`w-full bg-panel-2 border rounded px-3 py-2 text-sm transition-colors ${
                  formErrors.name ? "border-red-500" : "border-border"
                }`}
              />
              {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
            </div>

            {/* Test URL Button - Optional */}
            <details className="mb-2">
              <summary className="cursor-pointer text-xs text-muted hover:text-foreground transition-colors">
                🔍 Optional: Test connectivity before adding
              </summary>
              <div className="mt-2 pt-2 border-t border-border-hover space-y-2">
                <button
                  type="button"
                  onClick={handleTestUrl}
                  disabled={isTestingUrl || !urlInput.trim()}
                  className="w-full px-3 py-2 bg-panel-2 hover:bg-panel-3 border border-border rounded text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {isTestingUrl ? "Testing..." : "Test Connectivity"}
                </button>

                {connectivityStatus && (
                  <div
                    className={`p-2 rounded text-xs space-y-1 border ${
                      connectivityStatus.isReachable
                        ? "bg-green-950 border-green-800"
                        : "bg-red-950 border-red-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>URL Status:</span>
                      <span
                        className={
                          connectivityStatus.isReachable ? "text-green-400" : "text-red-400"
                        }
                      >
                        {connectivityStatus.isReachable ? "✓ Reachable" : "✗ Unreachable"}
                      </span>
                    </div>
                    {connectivityStatus.statusCode && (
                      <div className="text-muted text-xs">
                        Status: {connectivityStatus.statusCode}
                        {connectivityStatus.responseTime && ` (${connectivityStatus.responseTime}ms)`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>

            <button
              type="submit"
              disabled={createProfile.isPending}
              className="w-full px-3 py-2 bg-accent hover:bg-accent-dark text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {createProfile.isPending ? "Adding..." : "Update"}
            </button>
          </form>
        </Card>
      </div>

      {/* Current Configuration */}
      {config && (
        <div>
          <h3 className="text-sm font-medium mb-2">Active Configuration</h3>
          <Card className="p-4 space-y-2 text-sm">
            <div className="flex justify-between items-start">
              <span className="text-muted">Profile</span>
              <span className="font-medium text-green-400">{config.activeProfileId}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted">URL</span>
              <span className="mono text-xs break-all text-blue-400">{config.appBaseUrl}</span>
            </div>
          </Card>
        </div>
      )}

      {/* URL List */}
      {profiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Available URLs</h3>
          <div className="space-y-2">
            {profiles.map((profile) => (
              <Card
                key={profile.id}
                className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                  config?.activeProfileId === profile.id ? "border-accent bg-panel-2" : "hover:border-border-hover"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{profile.name}</div>
                  <div className="text-xs text-muted break-all">{profile.appBaseUrl}</div>
                </div>
                <button
                  onClick={() => switchProfile.mutate(profile.id)}
                  disabled={switchProfile.isPending || config?.activeProfileId === profile.id}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ml-2 ${
                    config?.activeProfileId === profile.id
                      ? "bg-green-900 text-green-200"
                      : "bg-panel-2 hover:bg-panel-3 border border-border text-foreground"
                  } disabled:opacity-50`}
                >
                  {config?.activeProfileId === profile.id ? "✓ Active" : "Switch"}
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
