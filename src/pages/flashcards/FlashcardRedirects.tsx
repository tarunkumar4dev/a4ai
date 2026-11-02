// Old flashcard URLs → the new pages (bookmarks and links keep working).
import { Navigate, useParams } from "react-router-dom";
import { deckHref, findLegacyDeck } from "@/lib/flashcardData";

/** /dashboard/flashcards/class/:class/subject/:subject */
export function LegacySubjectRedirect() {
  const { class: cls = "", subject = "" } = useParams();
  return <Navigate replace to={`/dashboard/flashcards?class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(subject)}`} />;
}

/** /dashboard/flashcards/:subject/:chapter (no class in the URL: the first class that has the chapter) */
export function LegacyDeckRedirect() {
  const { subject = "", chapter = "" } = useParams();
  const hit = findLegacyDeck(subject, Number.parseInt(chapter, 10));
  return <Navigate replace to={hit ? deckHref({ cls: hit.cls, subject, index: hit.index }) : "/dashboard/flashcards"} />;
}
