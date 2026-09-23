import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt-ts";

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@readseerr.local" },
  });

  if (!existingAdmin) {
    const passwordHash = await hash("changeme", 12);
    await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@readseerr.local",
        passwordHash,
        role: "admin",
      },
    });
    console.log("✅ Admin user created (admin@readseerr.local / changeme)");
    console.log("⚠️  Please change the default password after first login!");
  } else {
    console.log("ℹ️  Admin user already exists, skipping seed.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
