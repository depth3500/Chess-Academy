import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/plus-jakarta-sans';
import './styles.css';
import { initCloud } from './lib/cloud';
import { apply } from './lib/settings';

apply();
initCloud();

createRoot(document.getElementById('root')!).render(<App />);
