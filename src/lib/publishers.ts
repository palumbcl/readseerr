/**
 * Language filter for ComicVine volumes.
 *
 * ComicVine mixes every international edition (Spanish, German, Brazilian…)
 * and exposes no language field, so the publisher is the only usable signal.
 * A volume is kept only if its publisher is a known English- or French-language
 * publisher and does not carry a foreign-market marker ("Panini España",
 * "Glénat Spain", "Dargaud Benelux"…).
 *
 * Entries are matched as whole words against the normalized publisher name
 * (lowercase, no accents, punctuation → spaces). Add publishers here as needed.
 */

const ALLOWED_PUBLISHERS = [
  // US / UK comics
  "dc comics", "vertigo", "wildstorm", "milestone", "marvel", "epic comics",
  "image", "top cow", "skybound", "dark horse", "idw", "boom", "dynamite",
  "valiant", "acclaim", "archie", "oni press", "titan", "aftershock", "vault comics",
  "mad cave", "ahoy", "awa", "black mask", "scout comics", "ablaze", "lion forge",
  "magnetic press", "avatar press", "aspen", "zenescope", "action lab",
  "antarctic press", "american mythology", "devil s due", "keenspot", "dstlry",
  "bad idea", "legendary", "heavy metal", "abstract studio", "fantagraphics",
  "drawn quarterly", "first second", "nbm", "humanoids", "europe comics", "cinebook",
  "2000 ad", "rebellion", "fleetway", "dell", "gold key", "charlton", "eclipse",
  "first comics", "harvey", "fawcett", "quality comics", "ec", "papercutz",
  "hodder", "orion", "william morrow", "random house", "harper", "scholastic",
  "simon schuster", "penguin", "brockhampton", "new american library",
  "western publishing", "national comics", "murray comics", "world distributors",
  // English manga
  "viz", "kodansha", "yen press", "seven seas", "tokyopop", "del rey", "vertical",
  "udon", "j novel",
  // French BD / comics / manga
  "dargaud", "dupuis", "lombard", "casterman", "glenat", "delcourt", "soleil",
  "urban comics", "panini france", "semic france", "lug", "aredit", "artima",
  "sagedition", "editions heritage", "hachette", "les humanoides associes",
  "humanoides associes", "bamboo", "grand angle", "futuropolis", "albert rene",
  "fluide glacial", "vents d ouest", "rue de sevres", "akileos", "sarbacane",
  "gallimard", "marsu productions", "paquet", "le lombard", "kennes", "sandawe",
  "ankama", "label 619", "mosquito", "l association", "cornelius", "steinkis",
  "la boite a bulles", "404 editions", "hi comics", "komics initiative",
  "delirium", "kana", "pika", "kurokawa", "ki oon", "tonkam", "taifu", "doki doki",
  "akata", "ototo", "meian", "noeve", "vega", "michel lafon", "jungle",
];

const FOREIGN_MARKERS = [
  "spain", "espana", "espanol", "mexico", "argentina", "chile", "colombia",
  "brasil", "brazil", "portugal", "italia", "italy", "deutschland", "verlag",
  "benelux", "nederland", "polska", "rus", "nordic", "sverige", "danmark",
  "norge", "suomi", "turkiye", "hellas", "japan", "korea",
];

function normalize(name: string): string {
  return ` ${name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function containsWord(normalizedName: string, entry: string): boolean {
  return normalizedName.includes(` ${entry} `);
}

export function isEnglishOrFrenchPublisher(publisher: string | null | undefined): boolean {
  if (!publisher) return false;
  const name = normalize(publisher);
  if (FOREIGN_MARKERS.some((m) => containsWord(name, m))) return false;
  return ALLOWED_PUBLISHERS.some((p) => containsWord(name, p));
}
