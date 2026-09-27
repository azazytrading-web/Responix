import { AgentEditPage } from "../../../../../src/plugins/agent-management/form-page";

export default async function AgentConfigurationRoute({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return <AgentEditPage agentId={agentId} />;
}
