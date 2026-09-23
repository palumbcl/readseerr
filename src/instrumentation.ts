export async function register() {
  // Import conditionnel : le runtime edge ne doit pas embarquer Prisma / nodemailer
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadConfig } = await import("./lib/config");
    // Paramètres saisis dans /admin, chargés avant de servir la moindre requête
    await loadConfig().catch((error) => console.error("Chargement des paramètres échoué:", error));

    const { startLibrarySyncSchedule } = await import("./instrumentation-node");
    startLibrarySyncSchedule();
  }
}
