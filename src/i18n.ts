import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Minimal example resources; extend as needed
const resources = {
  "en-US": { translation: { hello: "Hello" } },
  "hi-IN": { translation: { hello: "नमस्ते" } },
  "bn-IN": { translation: { hello: "হ্যালো" } },
  "es-ES": { translation: { hello: "Hola" } },
  "pt-BR": { translation: { hello: "Olá" } },
  "fr-FR": { translation: { hello: "Bonjour" } },
  "ar-SA": { translation: { hello: "مرحبا" } },
  "id-ID": { translation: { hello: "Halo" } },
};

const stored = typeof window !== "undefined" ? localStorage.getItem("a4ai.locale") : null;
const browser = typeof navigator !== "undefined" ? navigator.language : "en-US";
const initial = stored || (resources[browser as keyof typeof resources] ? browser : "en-US");

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initial,
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
  });

export default i18n;
