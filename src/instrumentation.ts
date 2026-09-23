export async function register() {
  // Import conditionnel : le runtime edge ne doit pas embarquer Prisma / nodemailer
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLibrarySyncSchedule } = await import("./instrumentation-node");
    startLibrarySyncSchedule();
  }
}
