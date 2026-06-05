import { loginWithEmail } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/domain/services";
import { errorJson, okJson, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type LoginBody = {
  email?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<LoginBody>(request);
    const user = await loginWithEmail(body.email ?? "");
    return okJson({
      user,
      snapshot: await getDashboardSnapshot(user.id)
    });
  } catch (error) {
    return errorJson(error);
  }
}
