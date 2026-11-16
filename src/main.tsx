import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { apply } from './lib/settings';

apply();

createRoot(document.getElementById('root')!).render(<App />);
