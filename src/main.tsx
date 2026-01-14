import './lib/i18n'; // Initialize i18n
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Tracking is now initialized in App.tsx after cookie consent
createRoot(document.getElementById("root")!).render(<App />);
