/**
 * Séries candidates pour « Comics & BD les plus populaires ».
 * Aucune API ne publie les ventes ou lectures des comics : l'ordre affiché est calculé à partir des
 * consultations Wikipédia des 60 derniers jours (anglais + français), qui reflètent l'intérêt actuel
 * dans le monde (une adaptation en série fait par exemple remonter la BD d'origine).
 * Identifiants ComicVine vérifiés : pour les BD, l'édition originale en français ; pour les comics,
 * la série américaine d'origine. `en` / `fr` : titres des articles Wikipédia (redirections suivies).
 */
export interface PopularComicCandidate {
  id: string;
  title: string;
  en?: string;
  fr?: string;
}

export const POPULAR_COMIC_CANDIDATES: PopularComicCandidate[] = [
  // Franco-belge
  { id: "74147", title: "Astérix", en: "Asterix", fr: "Astérix" },
  { id: "32164", title: "Les Aventures de Tintin", en: "The Adventures of Tintin", fr: "Les Aventures de Tintin" },
  { id: "165634", title: "Lucky Luke", en: "Lucky Luke", fr: "Lucky Luke" },
  { id: "71000", title: "Les Schtroumpfs", en: "The Smurfs", fr: "Les Schtroumpfs" },
  { id: "51195", title: "Blake et Mortimer", en: "Blake and Mortimer", fr: "Blake et Mortimer" },
  { id: "40442", title: "XIII", en: "XIII (comics)", fr: "XIII (bande dessinée)" },
  { id: "31638", title: "Largo Winch", en: "Largo Winch", fr: "Largo Winch" },
  { id: "40719", title: "Thorgal", en: "Thorgal", fr: "Thorgal" },
  { id: "26644", title: "Blacksad", en: "Blacksad", fr: "Blacksad" },
  { id: "141868", title: "L'Arabe du futur", en: "The Arab of the Future", fr: "L'Arabe du futur" },
  { id: "27780", title: "Spirou et Fantasio", en: "Spirou & Fantasio", fr: "Spirou et Fantasio" },
  { id: "40540", title: "Gaston", en: "Gaston (comics)", fr: "Gaston Lagaffe" },
  { id: "84633", title: "Les Tuniques bleues", en: "Les Tuniques Bleues", fr: "Les Tuniques bleues" },
  { id: "140062", title: "Boule et Bill", en: "Boule et Bill", fr: "Boule et Bill" },
  { id: "53698", title: "Titeuf", en: "Titeuf", fr: "Titeuf" },
  { id: "134790", title: "Lanfeust de Troy", en: "Lanfeust of Troy", fr: "Lanfeust de Troy" },
  { id: "40586", title: "Blueberry", en: "Blueberry (comics)", fr: "Blueberry (bande dessinée)" },
  { id: "31487", title: "Valérian", en: "Valérian and Laureline", fr: "Valérian et Laureline" },
  { id: "106760", title: "Les Vieux Fourneaux", fr: "Les Vieux Fourneaux" },
  { id: "40757", title: "Persepolis", en: "Persepolis (comics)", fr: "Persepolis (bande dessinée)" },
  // Comics américains
  { id: "3622", title: "Watchmen", en: "Watchmen", fr: "Watchmen" },
  { id: "18166", title: "The Walking Dead", en: "The Walking Dead (comic book)", fr: "The Walking Dead (comics)" },
  { id: "2127", title: "The Amazing Spider-Man", en: "The Amazing Spider-Man", fr: "The Amazing Spider-Man" },
  { id: "38859", title: "Batman: The Dark Knight Returns", en: "The Dark Knight Returns", fr: "The Dark Knight Returns" },
  { id: "160294", title: "Absolute Batman", en: "Absolute Batman" },
  { id: "160511", title: "Absolute Wonder Woman", en: "Absolute Wonder Woman" },
  { id: "4207", title: "The Sandman", en: "The Sandman (comic book)", fr: "Sandman (comics)" },
  { id: "46568", title: "Saga", en: "Saga (comics)", fr: "Saga (comics)" },
  { id: "18960", title: "Batman: Year One", en: "Batman: Year One", fr: "Batman: Year One" },
  { id: "19967", title: "Batman: The Killing Joke", en: "Batman: The Killing Joke", fr: "Batman: The Killing Joke" },
  { id: "6822", title: "Batman: The Long Halloween", en: "Batman: The Long Halloween", fr: "Batman: Un long Halloween" },
  { id: "35076", title: "Batman: Hush", en: "Batman: Hush", fr: "Batman: Silence" },
  { id: "4034", title: "V for Vendetta", en: "V for Vendetta", fr: "V pour Vendetta" },
  { id: "17993", title: "Invincible", en: "Invincible (comics)", fr: "Invincible (comics)" },
  { id: "18033", title: "The Boys", en: "The Boys (comics)", fr: "The Boys (comics)" },
  { id: "18023", title: "Civil War", en: "Civil War (comics)", fr: "Civil War (comics)" },
  { id: "5753", title: "Kingdom Come", en: "Kingdom Come (comics)", fr: "Kingdom Come (comics)" },
  { id: "9419", title: "Y: The Last Man", en: "Y: The Last Man", fr: "Y, le dernier homme" },
  { id: "18139", title: "All Star Superman", en: "All-Star Superman", fr: "All-Star Superman" },
  { id: "5516", title: "Preacher", en: "Preacher (comics)", fr: "Preacher (comics)" },
  { id: "5388", title: "Hellboy", en: "Hellboy", fr: "Hellboy" },
  { id: "21649", title: "Sin City", en: "Sin City", fr: "Sin City" },
  { id: "19156", title: "The Umbrella Academy", en: "The Umbrella Academy", fr: "The Umbrella Academy" },
  { id: "25478", title: "Scott Pilgrim", en: "Scott Pilgrim", fr: "Scott Pilgrim" },
  { id: "121102", title: "Something is Killing the Children", en: "Something Is Killing the Children" },
  { id: "20701", title: "Locke & Key", en: "Locke & Key", fr: "Locke & Key" },
  { id: "5989", title: "Transmetropolitan", en: "Transmetropolitan", fr: "Transmetropolitan" },
  { id: "85776", title: "Monstress", en: "Monstress (comics)", fr: "Monstress" },
  { id: "85128", title: "Paper Girls", en: "Paper Girls", fr: "Paper Girls" },
];
