// src/pages/institute/instituteToast.ts
// Toasts of the institute dashboard: bottom-center, translucent, eased in (CSS `.a4-snack` in index.css), so they
// never cover the page's top-right action buttons (New Batch / Add Student). Same API as sonner's toast.
import { toast as sonner, type ExternalToast } from "sonner";

type Msg = Parameters<typeof sonner.success>[0];
const BASE: ExternalToast = { position: "bottom-center", className: "a4-snack" };

const make = (fn: (m: Msg, d?: ExternalToast) => string | number, extra: ExternalToast) =>
  (message: Msg, data?: ExternalToast) => fn(message, { ...BASE, ...extra, ...data });

export const toast = {
  success: make(sonner.success, { duration: 2500, closeButton: false }),
  info: make(sonner.info, { duration: 3000, closeButton: false }),
  message: make(sonner.message, { duration: 3000, closeButton: false }),
  warning: make(sonner.warning, { duration: 6000 }),
  error: make(sonner.error, { duration: 6000 }),
  dismiss: sonner.dismiss,
};
