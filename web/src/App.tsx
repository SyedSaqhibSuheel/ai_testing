import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAgentRunStream } from "@/lib/useAgentRunStream";
import { Dashboard } from "@/pages/Dashboard";
import { Requirements } from "@/pages/Requirements";
import { RequirementDetail } from "@/pages/RequirementDetail";
import { Scenarios } from "@/pages/Scenarios";
import { TestFiles } from "@/pages/TestFiles";
import { GitPage } from "@/pages/Git";
import { AgentActivity } from "@/pages/AgentActivity";
import { SettingsPage } from "@/pages/Settings";

export default function App() {
  useAgentRunStream();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/requirements" element={<Requirements />} />
        <Route path="/requirements/:id" element={<RequirementDetail />} />
        <Route path="/scenarios" element={<Scenarios />} />
        <Route path="/test-files" element={<TestFiles />} />
        <Route path="/git" element={<GitPage />} />
        <Route path="/agents" element={<AgentActivity />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
