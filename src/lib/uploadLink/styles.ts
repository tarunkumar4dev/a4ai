// src/lib/uploadLink/styles.ts — the upload-link feature's primary buttons use the app's black "Check copies" button
// style (Test History), never the purple --primary or the indigo gradients. Pressed = slight scale; disabled = faded.

export const BLACK_BTN =
  "bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 active:scale-95 active:bg-black transition-all " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

/** Selected chip / toggle (formats) — black instead of --primary. */
export const CHIP_ON = "border-gray-900 bg-gray-900 font-semibold text-white";
export const CHIP_OFF = "border-gray-300 text-gray-600 hover:border-gray-500";
