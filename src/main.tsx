import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import "@/i18n";  // added this on 21st august, 2025


createRoot(document.getElementById("root")!).render(<App />);
