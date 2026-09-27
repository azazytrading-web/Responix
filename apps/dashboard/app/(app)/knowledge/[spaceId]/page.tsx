import { KnowledgeBaseSpaceFormPage } from "../../../../src/plugins/knowledge-base/form-page";

export default async function KnowledgeSpaceRoute({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  return <KnowledgeBaseSpaceFormPage spaceId={spaceId} />;
}
