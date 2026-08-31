/**
 * URL Configuration Panel Component
 * Manages environment profiles with robust validation and error handling
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

interface FormErrors {
  id?: string;
  name?: string;
  appBaseUrl?: string;
  apiBaseUrl?: string;
}

interface ConnectivityStatus {
  app?: { isReachable: boolean; message: string; statusCode?: number; responseTime?: number };
  api?: { isReachable: boolean; message: string; statusCode?: number; responseTime?: number };
  error?: string;
}

export function URLConfigPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    appBaseUrl: "",
    apiBaseUrl: "",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus | null>(null);
  const [isTestingForm, setIsTestingForm] = useState(false);

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
    mutationFn: async (profile: typeof formData) => {
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
      setFormData({ id: "", name: "", appBaseUrl: "", apiBaseUrl: "", description: "" });
      setFormErrors({});
      setConnectivityStatus(null);
      setShowForm(false);
    },
    onError: (error) => {
      alert(`Failed to create profile: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  // Test connectivity mutation
  const testConnectivity = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error("No active configuration");
      return testURLConnectivity(config.appBaseUrl, config.apiBaseUrl);
    },
  });

  // Validate form
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.id.trim()) {
      errors.id = "Profile ID is required";
    } else if (!/^[a-z0-9_-]+$/.test(formData.id)) {
      errors.id = "Profile ID can only contain lowercase letters, numbers, underscores, and hyphens";
    }

    if (!formData.name.trim()) {
      errors.name = "Display name is required";
    }

    if (formData.appBaseUrl.trim()) {
      const validation = validateURL(formData.appBaseUrl);
      if (!validation.isValid) {
        errors.appBaseUrl = validation.errors[0];
      }
    }

    if (formData.apiBaseUrl.trim()) {
      const validation = validateURL(formData.apiBaseUrl);
      if (!validation.isValid) {
        errors.apiBaseUrl = validation.errors[0];
      }
    }

    if (!formData.appBaseUrl.trim() && !formData.apiBaseUrl.trim()) {
      errors.appBaseUrl = "At least one URL must be provided";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTestFormConnectivity = async () => {
    if (!validateForm()) return;

    setIsTestingForm(true);
    try {
      const result = await testURLConnectivity(
        formData.appBaseUrl || undefined,
        formData.apiBaseUrl || undefined
      );
      setConnectivityStatus(result as ConnectivityStatus);
    } catch (error) {
      setConnectivityStatus({
        error: formatErrorMessage(error instanceof Error ? error : new Error(String(error))),
      });
    } finally {
      setIsTestingForm(false);
    }
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    createProfile.mutate(formData);
  };

  const handleTestActiveConnectivity = async () => {
    try {
      const result = await testConnectivity.mutateAsync();
      setConnectivityStatus(result as ConnectivityStatus);
    } catch (error) {
      setConnectivityStatus({
        error: formatErrorMessage(error instanceof Error ? error : new Error(String(error))),
      });
    }
  };

  const isLoading = configLoading || profilesLoading;

  if (isLoading) {
    return <div className="text-sm text-muted">Loading URL configuration...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Current Configuration */}
      <div>
        <h3 className="text-sm font-medium mb-2">Active Environment</h3>
        <Card className="p-4 space-y-3 text-sm">
          {config && (
            <>
              <div className="flex justify-between items-start">
                <span className="text-muted">Profile</span>
                <span className="font-medium text-green-400">{config.activeProfileId}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted">App URL</span>
                <span className="mono text-xs break-all text-blue-400">{config.appBaseUrl}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted">API URL</span>
                <span className="mono text-xs break-all text-blue-400">{config.apiBaseUrl}</span>
              </div>

              {/* Connectivity Status Display */}
              {connectivityStatus && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {connectivityStatus.error ? (
                    <div className="p-2 bg-red-950 border border-red-800 rounded text-xs text-red-200">
                      {connectivityStatus.error}
                    </div>
                  ) : (
                    <>
                      {connectivityStatus.app && (
                        <div className="flex items-center justify-between">
                          <span>App Status:</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-medium ${
                                connectivityStatus.app.isReachable
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {connectivityStatus.app.isReachable ? "✓ Connected" : "✗ Failed"}
                            </span>
                            {connectivityStatus.app.statusCode && (
                              <span className="text-xs text-muted">
                                ({connectivityStatus.app.statusCode}, {connectivityStatus.app.responseTime}ms)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {connectivityStatus.api && (
                        <div className="flex items-center justify-between">
                          <span>API Status:</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-medium ${
                                connectivityStatus.api.isReachable ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {connectivityStatus.api.isReachable ? "✓ Connected" : "✗ Failed"}
                            </span>
                            {connectivityStatus.api.statusCode && (
                              <span className="text-xs text-muted">
                                ({connectivityStatus.api.statusCode}, {connectivityStatus.api.responseTime}ms)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                onClick={handleTestActiveConnectivity}
                disabled={testConnectivity.isPending}
                className="mt-3 w-full px-3 py-2 bg-panel-2 hover:bg-panel-3 border border-border rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                {testConnectivity.isPending ? "Testing..." : "Test Connectivity"}
              </button>
            </>
          )}
        </Card>
      </div>

      {/* Profile Switcher */}
      <div>
        <h3 className="text-sm font-medium mb-2">Switch Environment</h3>
        <div className="space-y-2">
          {profiles.map((profile) => (
            <Card
              key={profile.id}
              className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                config?.activeProfileId === profile.id ? "border-accent bg-panel-2" : "hover:border-border-hover"
              }`}
            >
              <div>
                <div className="text-sm font-medium">{profile.name}</div>
                <div className="text-xs text-muted">{profile.description || profile.id}</div>
              </div>
              <button
                onClick={() => switchProfile.mutate(profile.id)}
                disabled={switchProfile.isPending || config?.activeProfileId === profile.id}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
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

      {/* Add New Profile Form */}
      <div>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full px-4 py-2 bg-panel-2 hover:bg-panel-3 border border-border rounded text-sm font-medium transition-colors"
          >
            + Add Environment Profile
          </button>
        ) : (
          <Card className="p-4 space-y-3">
            <h3 className="font-medium text-sm">New Profile</h3>
            <form onSubmit={handleCreateProfile} className="space-y-3">
              <div>
                <label htmlFor="profile-id" className="text-xs text-muted block mb-1">
                  Profile ID (e.g., staging)
                </label>
                <input
                  id="profile-id"
                  type="text"
                  value={formData.id}
                  onChange={(e) => {
                    setFormData({ ...formData, id: e.target.value });
                    if (formErrors.id) setFormErrors({ ...formErrors, id: undefined });
                  }}
                  placeholder="staging"
                  className={`w-full bg-panel-2 border rounded px-2 py-1.5 text-sm transition-colors ${
                    formErrors.id ? "border-red-500" : "border-border"
                  }`}
                />
                {formErrors.id && <p className="text-xs text-red-400 mt-1">{formErrors.id}</p>}
              </div>

              <div>
                <label htmlFor="profile-name" className="text-xs text-muted block mb-1">
                  Display Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                  }}
                  placeholder="Staging Environment"
                  className={`w-full bg-panel-2 border rounded px-2 py-1.5 text-sm transition-colors ${
                    formErrors.name ? "border-red-500" : "border-border"
                  }`}
                />
                {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="app-base-url" className="text-xs text-muted block mb-1">
                  App Base URL (e.g., http://localhost:5000)
                </label>
                <input
                  id="app-base-url"
                  type="text"
                  value={formData.appBaseUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, appBaseUrl: e.target.value });
                    if (formErrors.appBaseUrl) setFormErrors({ ...formErrors, appBaseUrl: undefined });
                  }}
                  placeholder="http://localhost:5000"
                  className={`w-full bg-panel-2 border rounded px-2 py-1.5 text-sm transition-colors ${
                    formErrors.appBaseUrl ? "border-red-500" : "border-border"
                  }`}
                />
                {formErrors.appBaseUrl && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.appBaseUrl}</p>
                )}
              </div>

              <div>
                <label htmlFor="api-base-url" className="text-xs text-muted block mb-1">
                  API Base URL (e.g., http://localhost:8084/api)
                </label>
                <input
                  id="api-base-url"
                  type="text"
                  value={formData.apiBaseUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, apiBaseUrl: e.target.value });
                    if (formErrors.apiBaseUrl) setFormErrors({ ...formErrors, apiBaseUrl: undefined });
                  }}
                  placeholder="http://localhost:8084/api"
                  className={`w-full bg-panel-2 border rounded px-2 py-1.5 text-sm transition-colors ${
                    formErrors.apiBaseUrl ? "border-red-500" : "border-border"
                  }`}
                />
                {formErrors.apiBaseUrl && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.apiBaseUrl}</p>
                )}
              </div>

              <div>
                <label htmlFor="profile-description" className="text-xs text-muted block mb-1">
                  Description (Optional)
                </label>
                <input
                  id="profile-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., QA testing environment"
                  className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
                />
              </div>

              {/* Test Connectivity Button */}
              <button
                type="button"
                onClick={handleTestFormConnectivity}
                disabled={isTestingForm}
                className="w-full px-3 py-2 bg-panel-2 hover:bg-panel-3 border border-border rounded text-xs font-medium transition-colors disabled:opacity-50 mb-2"
              >
                {isTestingForm ? "Testing..." : "Test These URLs"}
              </button>

              {/* Connectivity Status for Form */}
              {connectivityStatus && (
                <div className="p-2 bg-panel-2 border border-border rounded text-xs space-y-1">
                  {connectivityStatus.error ? (
                    <div className="text-red-400">{connectivityStatus.error}</div>
                  ) : (
                    <>
                      {connectivityStatus.app && (
                        <div className="flex items-center justify-between">
                          <span>App:</span>
                          <span
                            className={connectivityStatus.app.isReachable ? "text-green-400" : "text-red-400"}
                          >
                            {connectivityStatus.app.isReachable ? "✓ Connected" : "✗ Failed"}
                          </span>
                        </div>
                      )}
                      {connectivityStatus.api && (
                        <div className="flex items-center justify-between">
                          <span>API:</span>
                          <span
                            className={connectivityStatus.api.isReachable ? "text-green-400" : "text-red-400"}
                          >
                            {connectivityStatus.api.isReachable ? "✓ Connected" : "✗ Failed"}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createProfile.isPending || Object.keys(formErrors).length > 0}
                  className="flex-1 px-3 py-2 bg-accent hover:bg-accent-dark text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {createProfile.isPending ? "Creating..." : "Create Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ id: "", name: "", appBaseUrl: "", apiBaseUrl: "", description: "" });
                    setFormErrors({});
                    setConnectivityStatus(null);
                  }}
                  className="flex-1 px-3 py-2 bg-panel-2 hover:bg-panel-3 border border-border rounded text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
