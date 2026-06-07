import { redirect } from "next/navigation";
import { LoginClient } from "@/components/login-client";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LoginClient />;
}
