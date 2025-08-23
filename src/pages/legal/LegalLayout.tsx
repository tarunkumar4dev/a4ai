import { Link } from "react-router-dom";

export default function LegalLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[70vh]">
      <header className="bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-950 border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle ? <p className="text-gray-600 dark:text-gray-300 mt-2">{subtitle}</p> : null}
          <nav className="mt-4 text-sm text-gray-600 dark:text-gray-400 flex gap-4">
            <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400">Terms</Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400">Privacy</Link>
            <span>•</span>
            <Link to="/cookies" className="hover:text-indigo-600 dark:hover:text-indigo-400">Cookies</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
