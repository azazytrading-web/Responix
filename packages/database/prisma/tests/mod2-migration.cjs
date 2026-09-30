// Dedicated database only. No application secrets or production records are copied.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const root = path.resolve(__dirname, "../../../..");
const raw = fs.readFileSync(path.join(root, ".env"), "utf8").match(/^DATABASE_URL\s*=\s*(.*)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const url = new URL(raw);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
url.pathname = "/responix_mod2_catalog_test";
const prisma = new PrismaClient({ datasourceUrl: url.toString(), log: [] });
const models = [
 ["e465f170-cb80-40b7-bdf5-b24618e8d345","c06d5528-b7fd-469b-92b6-71c935e7f4c6","OpenAI","gpt-4.1-mini","GPT-4.1 mini",1000000],
 ["773cf74d-3f5e-4367-9476-bde148084a26","fc4aa630-9be3-4901-ad35-d40b836bc355","Claude","claude-3-5-sonnet-latest","Claude 3.5 Sonnet",200000],
 ["411420da-0f99-498b-a243-37e6cb05b6d2","1243c1ba-f714-487d-b365-a18fa309ecf3","Gemini","gemini-2.0-flash","Gemini 2.0 Flash",1000000],
 ["0cdce9fb-e6ef-4b0b-aa97-17e9b839d076","c6a98052-0dea-4dbf-a9f1-1a0b2d70a0d0","Azure OpenAI","gpt-4.1-mini","Azure GPT-4.1 mini",1000000],
 ["5aaab998-f619-42b4-9d3c-9bb9d8e8e65b","272239f3-21ea-4ad8-8c60-f2bbddfb3b7e","OpenRouter","openai/gpt-4.1-mini","OpenRouter GPT-4.1 mini",1000000],
 ["5a14a1e3-06bf-45a4-b75f-f296adbd9c2c","db01c57f-bfbb-42e5-8029-e78d4cf24546","DeepSeek","deepseek-chat","DeepSeek Chat",65536]
];
const workspace = "10000000-0000-4000-8000-000000000001";
const agent = "10000000-0000-4000-8000-000000000002";
const invocation = "10000000-0000-4000-8000-000000000003";
async function main() {
 assert.equal((await prisma.$queryRawUnsafe("SELECT current_database() AS name"))[0].name, "responix_mod2_catalog_test");
 if (process.argv[2] === "fixture") {
  assert.equal((await prisma.$queryRawUnsafe("SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL"))[0].n,43);
  await prisma.$transaction(async tx => {
   for (const [id,provider,name,slug,display,context] of models) {
    await tx.$executeRawUnsafe('INSERT INTO ai_providers(id,provider_name,updated_at) VALUES($1::uuid,$2,now())',provider,name);
    await tx.$executeRawUnsafe('INSERT INTO ai_models(id,provider_id,model_name,display_name,context_window,updated_at) VALUES($1::uuid,$2::uuid,$3,$4,$5,now())',id,provider,slug,display,context);
   }
   await tx.$executeRawUnsafe("INSERT INTO ai_models(id,provider_id,model_name,display_name,context_window,supports_vision,supports_audio,supports_tools,supports_reasoning,supports_streaming,supports_json,supports_function_calling,supports_video,supports_mcp,updated_at) VALUES('10000000-0000-4000-8000-000000000004',$1::uuid,'Legacy/TRUE','Legacy evidence fixture',4096,true,true,true,true,true,true,true,true,true,now())",models[0][1]);
   await tx.$executeRawUnsafe("INSERT INTO workspaces(id,name,slug,updated_at) VALUES($1::uuid,'MOD2 fixture','mod2-fixture',now())",workspace);
   await tx.$executeRawUnsafe("INSERT INTO ai_agents(id,workspace_id,name,prompt,provider_id,model_id,max_tokens,status,updated_at) VALUES($1::uuid,$2::uuid,'Migration fixture','fixture',$3::uuid,$4::uuid,10,'ACTIVE',now())",agent,workspace,models[0][1],models[0][0]);
   await tx.$executeRawUnsafe("INSERT INTO ai_invocation_logs(id,workspace_id,request_id,provider_id,model_id,agent_id,task_type,updated_at) VALUES($1::uuid,$2::uuid,'mod2-history',$3::uuid,$4::uuid,$5::uuid,'CHAT',now())",invocation,workspace,models[0][1],models[0][0],agent);
   await tx.$executeRawUnsafe("INSERT INTO ai_cost_records(id,workspace_id,invocation_id,provider_id,model_id,input_cost,output_cost,total_cost,updated_at) VALUES(gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,$4::uuid,1.25,2.5,3.75,now())",workspace,invocation,models[0][1],models[0][0]);
  });
  console.log("PASS: 43-migration legacy fixture: six stable model/provider IDs, one all-true model, active Agent and historical cost.");
 } else if (process.argv[2] === "check") {
  assert.equal((await prisma.$queryRawUnsafe("SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL"))[0].n,44);
  for(const [id,provider,,slug] of models){const row=(await prisma.$queryRawUnsafe('SELECT * FROM ai_models WHERE id=$1::uuid',id))[0];assert.equal(row.provider_id,provider);assert.equal(row.model_name,slug);assert.equal(row.provider_model_id,slug);assert.equal(row.source,"BUILT_IN");assert.equal(row.owner_workspace_id,null);assert.equal(row.status,"ACTIVE");}
  const caps=await prisma.$queryRawUnsafe('SELECT * FROM ai_model_capabilities');
  assert.equal(caps.length,63);
  for(const c of caps){assert.equal(c.source,"PLATFORM_CURATED");assert.equal(c.state,c.model_id==="10000000-0000-4000-8000-000000000004"?"SUPPORTED":"UNKNOWN");}
  for(const p of await prisma.$queryRawUnsafe('SELECT * FROM ai_model_prices')){assert.equal(p.state,"UNKNOWN");assert.equal(p.input_rate,null);assert.equal(p.output_rate,null);}
  assert.equal((await prisma.$queryRawUnsafe('SELECT model_id FROM ai_agents WHERE id=$1::uuid',agent))[0].model_id,models[0][0]);
  assert.equal((await prisma.$queryRawUnsafe('SELECT total_cost::text AS cost FROM ai_cost_records WHERE invocation_id=$1::uuid',invocation))[0].cost,"3.750000");
  const indexes=await prisma.$queryRawUnsafe("SELECT indexname,indexdef FROM pg_indexes WHERE tablename='ai_models'");
  assert.equal(indexes.filter(i=>i.indexname.includes('identity_key')).length,3);
  console.log("PASS: 44 migrations; six UUID/provider/alias/source/lifecycle backfills; 63 true/false capability records; UNKNOWN price; Agent/history preservation; three scoped unique indexes.");
 } else throw Error("Use fixture or check");
}
main().catch(e=>{console.error("FAIL",e.code||e.name, e.name==="AssertionError" ? e.message : "Database operation failed; credentials suppressed");process.exitCode=1;}).finally(()=>prisma.$disconnect());
