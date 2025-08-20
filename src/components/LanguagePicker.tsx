// src/components/LanguagePicker.tsx
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Minimal stub: shows a globe and a popover that says "coming soon".
 * No i18n imports or locale changes yet.
 * Safe to keep in production until translations are ready.
 */
export default function LanguagePicker() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-600 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:bg-gray-800/60"
          aria-label="Language (coming soon)"
          title="Language & Region — coming soon"
        >
          <Globe className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72">
        <div className="text-sm font-semibold">Language &amp; Region</div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Coming soon. You’ll be able to switch the UI language, number/date formats,
          and default currency here.
        </p>
      </PopoverContent>
    </Popover>
  );
}
