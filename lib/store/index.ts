import { memoryRepository } from "@/lib/store/memory-repository";
import type { CreditRepository } from "@/lib/store/repository";

let repository: CreditRepository | undefined;

export function getCreditRepository(): CreditRepository {
  if (repository) {
    return repository;
  }

  if (process.env.STORAGE_DRIVER === "prisma") {
    // Lazy require keeps the default mock flow independent from DATABASE_URL.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prismaRepository } = require("@/lib/store/prisma-repository") as {
      prismaRepository: CreditRepository;
    };
    repository = prismaRepository;
    return repository;
  }

  repository = memoryRepository;
  return repository;
}
