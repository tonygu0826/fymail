"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { seedLocalMvpData } from "@/lib/mvp-data";

function redirectWithState(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  redirect(query ? `/settings?${query}` : "/settings");
}

export async function seedMvpAction() {
  try {
    await seedLocalMvpData();
    revalidatePath("/dashboard");
    revalidatePath("/templates");
    revalidatePath("/contacts");
    revalidatePath("/campaigns");
    revalidatePath("/settings");
    revalidatePath("/status");
    redirectWithState({
      message: "Local MVP seed refreshed",
    });
  } catch (error) {
    redirectWithState({
      error: error instanceof Error ? error.message : "Unable to seed local MVP data",
    });
  }
}
