import { auth } from "@/lib/auth";

export async function optionalAuth() {
  try {
    return await auth();
  } catch {
    return null;
  }
}
