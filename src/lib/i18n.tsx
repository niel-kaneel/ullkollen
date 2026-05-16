import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "sv" | "en";

// Use t("key") for strings used 2+ times or shared across components.
// Use t({ sv, en }) for one-off dynamic labels.
const dict = {
  sv: {
    appName: "Ullkollen",
    tagline: "Klassificera din ull med AI",
    // nav
    home: "Hem",
    flock: "Min flock",
    shearers: "Klippare",
    profile: "Profil",
    // auth
    signIn: "Logga in",
    signUp: "Skapa konto",
    signOut: "Logga ut",
    email: "E-post",
    password: "Lösenord",
    or: "eller",
    noAccount: "Inget konto?",
    haveAccount: "Har du redan konto?",
    // profile
    fullName: "Fullständigt namn",
    farmName: "Gårdens namn",
    phone: "Telefon",
    address: "Adress",
    role: "Roll",
    farmer: "Bonde",
    shearerRole: "Klippare",
    save: "Spara",
    updateLocation: "Uppdatera plats",
    locationSaved: "Plats sparad",
    language: "Språk",
    // home
    newClassification: "Ny klassificering",
    recent: "Senaste klassificeringar",
    noClassificationsYet: "Inga klassificeringar ännu. Tryck på knappen ovan för att börja.",
    // classify
    takePhotos: "Ta minst 2 bilder",
    photo1: "Närbild på ullen (10–20 cm bort)",
    photo2: "Helkroppsbild av fåret",
    photo3: "Valfritt: ullfiber mot linjal",
    addPhoto: "Lägg till bild",
    retake: "Ta om",
    next: "Nästa",
    metadata: "Information om fåret",
    sheepName: "Fårets namn / ID",
    breed: "Ras",
    ageCategory: "Ålderskategori",
    monthsSinceLastShear: "Månader sedan senaste klippning",
    classify: "Klassificera",
    analyzing: "Analyserar ull...",
    // result
    confidence: "Säkerhet",
    high: "Hög",
    medium: "Medel",
    low: "Låg",
    recommendation: "Rekommendation",
    bookShearer: "Boka klippare",
    saveToFlock: "Spara till flock",
    saved: "Sparad",
    savedSuccess: "Sparat",
    // shearers
    shearersNearYou: "Klippare nära dig",
    findShearers: "Hitta fårklippare",
    filterAll: "Alla",
    filterCertified: "Certifierade",
    filterNear50: "Inom 50 km",
    filterNear100: "Inom 100 km",
    enableLocationTitle: "Aktivera plats för att se närmaste klippare",
    enableLocationBtn: "Aktivera plats",
    showingAllAlpha: "Visar alla klippare i bokstavsordning. Aktivera plats för avståndssortering.",
    kmAway: "km bort",
    call: "Ring",
    sms: "SMS",
    emailAction: "E-post",
    languagesLabel: "Språk",
    specializesIn: "Raser",
    // misc
    back: "Tillbaka",
    cancel: "Avbryt",
    error: "Något gick fel",
    needAtLeast2Photos: "Du behöver minst 2 bilder",
    uploading: "Laddar upp bilder...",
    delete: "Ta bort",
    deleted: "Borttagen",
    deletedSuccess: "Borttaget",
    deleteConfirm: "Är du säker? Detta kan inte ångras.",
    deleteSheepConfirm: "Ta bort detta får?",
    admin: "Admin",
    users: "Användare",
    statistics: "Statistik",
    totalUsers: "Användare totalt",
    totalClassifications: "Klassificeringar totalt",
    totalSheep: "Får totalt",
    makeAdmin: "Gör till admin",
    removeAdmin: "Ta bort admin",
    deleteUser: "Radera användare",
    confirmDeleteUser: "Radera användare och all deras data permanent?",
    classifications: "Klassificeringar",
    sheepCount: "Får",
    joined: "Registrerad",
  },
  en: {
    appName: "Ullkollen",
    tagline: "Classify your wool with AI",
    home: "Home",
    flock: "My flock",
    shearers: "Shearers",
    profile: "Profile",
    signIn: "Sign in",
    signUp: "Sign up",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    or: "or",
    noAccount: "No account?",
    haveAccount: "Already have an account?",
    fullName: "Full name",
    farmName: "Farm name",
    phone: "Phone",
    address: "Address",
    role: "Role",
    farmer: "Farmer",
    shearerRole: "Shearer",
    save: "Save",
    updateLocation: "Update location",
    locationSaved: "Location saved",
    language: "Language",
    newClassification: "New classification",
    recent: "Recent classifications",
    noClassificationsYet: "No classifications yet. Tap the button above to start.",
    takePhotos: "Take at least 2 photos",
    photo1: "Close-up of the wool (10–20 cm away)",
    photo2: "Full-body shot of the sheep",
    photo3: "Optional: wool fiber against a ruler",
    addPhoto: "Add photo",
    retake: "Retake",
    next: "Next",
    metadata: "Sheep information",
    sheepName: "Sheep name / ID",
    breed: "Breed",
    ageCategory: "Age category",
    monthsSinceLastShear: "Months since last shearing",
    classify: "Classify",
    analyzing: "Analyzing wool...",
    confidence: "Confidence",
    high: "High",
    medium: "Medium",
    low: "Low",
    recommendation: "Recommendation",
    bookShearer: "Book shearer",
    saveToFlock: "Save to flock",
    saved: "Saved",
    savedSuccess: "Saved",
    // shearers
    shearersNearYou: "Shearers near you",
    findShearers: "Find shearers",
    filterAll: "All",
    filterCertified: "Certified",
    filterNear50: "Within 50 km",
    filterNear100: "Within 100 km",
    enableLocationTitle: "Enable location to see the nearest shearers",
    enableLocationBtn: "Enable location",
    showingAllAlpha: "Showing all shearers alphabetically. Enable location for distance sorting.",
    kmAway: "km away",
    call: "Call",
    sms: "SMS",
    emailAction: "Email",
    languagesLabel: "Languages",
    specializesIn: "Breeds",
    back: "Back",
    cancel: "Cancel",
    error: "Something went wrong",
    needAtLeast2Photos: "You need at least 2 photos",
    uploading: "Uploading photos...",
    delete: "Delete",
    deleted: "Deleted",
    deletedSuccess: "Deleted",
    deleteConfirm: "Are you sure? This cannot be undone.",
    deleteSheepConfirm: "Delete this sheep?",
    admin: "Admin",
    users: "Users",
    statistics: "Statistics",
    totalUsers: "Total users",
    totalClassifications: "Total classifications",
    totalSheep: "Total sheep",
    makeAdmin: "Make admin",
    removeAdmin: "Remove admin",
    deleteUser: "Delete user",
    confirmDeleteUser: "Permanently delete user and all their data?",
    classifications: "Classifications",
    sheepCount: "Sheep",
    joined: "Joined",
  },
} as const;

type Key = keyof typeof dict.sv;
type Inline = { sv: string | null | undefined; en: string | null | undefined };
export type Translatable = Key | Inline;

function translate(lang: Lang, k: Translatable): string {
  if (typeof k === "string") return dict[lang][k] ?? dict.sv[k];
  return (k[lang] ?? k.sv ?? "") as string;
}

const I18nCtx = createContext<{ lang: Lang; t: (k: Translatable) => string; setLang: (l: Lang) => void }>({
  lang: "sv",
  t: (k) => translate("sv", k),
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("sv");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem("ullkollen.lang") as Lang | null) : null;
    if (stored === "sv" || stored === "en") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("ullkollen.lang", l);
  };

  const t = (k: Translatable) => translate(lang, k);

  return <I18nCtx.Provider value={{ lang, t, setLang }}>{children}</I18nCtx.Provider>;
}

export const useTranslation = () => useContext(I18nCtx);
