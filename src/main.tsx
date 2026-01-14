import './lib/i18n'; // Initialize i18n
import { initSentry } from './lib/sentry';
import { initPostHog } from './lib/posthog';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize observability services
initSentry();
initPostHog();

createRoot(document.getElementById("root")!).render(<App />);
