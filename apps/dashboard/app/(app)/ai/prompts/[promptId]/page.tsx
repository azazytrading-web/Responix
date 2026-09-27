import { PromptEditPage } from "../../../../../src/plugins/prompt-library/form-page";
export default async function Page({params}:{params:Promise<{promptId:string}>}){const {promptId}=await params;return <PromptEditPage promptId={promptId}/>}
