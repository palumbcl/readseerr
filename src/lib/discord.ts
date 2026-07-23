export async function sendDiscordNotification({
  title,
  mediaType,
  userName,
}: {
  title: string;
  mediaType: string;
  userName?: string | null;
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  const typeLabel = mediaType === "manga" ? "🇯🇵 Manga" : mediaType === "comic" ? "🇺🇸 Comic" : "🇫🇷 BD";

  const payload = {
    embeds: [
      {
        title: "Nouvelle demande de lecture !",
        description: `Une nouvelle demande a été ajoutée à la liste de souhaits.`,
        color: 6513507, // Un joli violet (correspondant au thème #6366f1)
        fields: [
          {
            name: "Titre",
            value: title,
            inline: true,
          },
          {
            name: "Type",
            value: typeLabel,
            inline: true,
          },
          {
            name: "Demandé par",
            value: userName || "Utilisateur inconnu",
            inline: false,
          },
        ],
        footer: {
          text: "Va sur Prowlarr pour lancer le téléchargement ! 🏴‍☠️",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Erreur lors de l'envoi de la notification Discord:", await response.text());
    } else {
      console.log("Notification Discord envoyée avec succès.");
    }
  } catch (error) {
    console.error("Erreur réseau (Discord webhook):", error);
  }
}
