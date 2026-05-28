import { runAgentTask } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type RunAgentBody = {
  userId: string;
  taskName: string;
  prompt: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<RunAgentBody>(request);
    return okJson(await runAgentTask(body));
  } catch (error) {
    return errorJson(error);
  }
}
