import App from './App.tsx'
import Preferences from './Preferences.tsx'
import About from './About.tsx'

export default function Root() {
  const hash = window.location.hash;
  if (hash === '#preferences') {
    return <Preferences />;
  }
  if (hash === '#about') {
    return <About />;
  }
  return <App />;
}
