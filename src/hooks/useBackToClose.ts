// src/hooks/useBackToClose.ts
// Phone / browser Back closes an open modal instead of leaving the page. Opening pushes a history entry for the
// same URL whose state lists the open modals (a stack, so a modal opened on top of another closes first);
// Back pops it and the modal closes. Closing from the UI (Cancel, ×, Save) pops that entry again, so no
// dead entries pile up in the history.
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type ModalState = { a4modals?: string[] } & Record<string, unknown>;

/** Ids of the modals whose history entry this location state is (empty for a normal page entry). */
export const modalsOf = (state: unknown): string[] => {
  const m = (state as ModalState | null)?.a4modals;
  return Array.isArray(m) ? m : [];
};

export function useBackToClose(open: boolean, close: () => void, id: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const pushed = useRef(false);
  const closeRef = useRef(close);
  closeRef.current = close;
  const locRef = useRef(location);
  locRef.current = location;

  useEffect(() => {
    const loc = locRef.current;
    if (open && !pushed.current) {
      pushed.current = true;
      const state = (loc.state as ModalState | null) ?? {};
      navigate(`${loc.pathname}${loc.search}${loc.hash}`, { state: { ...state, a4modals: [...modalsOf(state), id] } });
    } else if (!open && pushed.current) {
      // closed from the UI: drop our entry if it is still the current one (react-router keeps state in history.state.usr)
      pushed.current = false;
      const top = modalsOf((window.history.state as { usr?: unknown } | null)?.usr).at(-1);
      if (top === id) navigate(-1);
    }
  }, [open, id, navigate]);

  useEffect(() => {
    // Back (or any navigation) left the entry that had this modal open → close it
    if (pushed.current && !modalsOf(location.state).includes(id)) {
      pushed.current = false;
      closeRef.current();
    }
  }, [location, id]);
}
