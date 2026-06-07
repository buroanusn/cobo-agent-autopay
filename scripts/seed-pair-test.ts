import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const user = await p.user.findFirst({ where: { email: "demo@agent.local" }, select: { id: true }});
  if (!user) { console.log("demo user missing"); process.exit(1); }
  console.log("using user:", user.id);
  await p.cawPairingSession.deleteMany({ where: { userId: user.id } });
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const created = await p.cawPairingSession.create({
    data: {
      userId: user.id,
      code: "CAW-DEMO1",
      status: "generated",
      expiresAt
    }
  });
  console.log("created:", JSON.stringify({
    code: created.code,
    status: created.status,
    expiresAt: created.expiresAt.toISOString()
  }));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
