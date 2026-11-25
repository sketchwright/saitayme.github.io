import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from '@components/Navbar'
import { initGA, usePageTracking } from '@/utils/analytics'
import { useEffect, useState } from 'react'
// import BackgroundAnimation from '@components/BackgroundAnimation' // Temporarily disabled for performance
import LoadingScreen from '@components/LoadingScreen'

// Lazy load pages
const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Projects = lazy(() => import('./pages/Projects'))
const Contact = lazy(() => import('./pages/Contact'))
// Game is code-split: only downloaded when opened, and a broken/in-progress game can't take the site down
const CyberGame = lazy(() => import('@components/CyberGame'))

const App = () => {
  const [showGame, setShowGame] = useState(false)

  useEffect(() => {
    // Konami code implementation
    const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    let current = 0;

    const keyHandler = (e: KeyboardEvent) => {
      if (e.code === sequence[current]) {
        current++;
        if (current === sequence.length) {
          setShowGame(true);
          current = 0;
        }
      } else {
        current = 0;
      }
    };

    const openGame = () => setShowGame(true);
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('open-cyber-defender', openGame);
    return () => {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('open-cyber-defender', openGame);
    };
  }, []);

  useEffect(() => {
    // Only initialize GA if we have a measurement ID
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (measurementId) {
      initGA(measurementId);
    }
  }, []);

  // Only track pages if GA is initialized
  if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
    usePageTracking();
  }

  return (
    <div className="min-h-screen bg-cyber-black text-gray-100 relative">
      {/* <BackgroundAnimation /> */} {/* Disabled for performance testing */}
      
      {/* Main Content */}
      <div className="relative z-10">
        <Navbar />
        <Suspense fallback={<LoadingScreen />}>
          <main>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home onPlayGame={() => setShowGame(true)} />} />
                <Route path="/about" element={<About />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/contact" element={<Contact />} />
              </Routes>
            </AnimatePresence>
          </main>
        </Suspense>
      </div>

      {/* Static film grain (Ember mono) */}
      <div className="film-grain" aria-hidden />

      {/* Game Modal */}
      {showGame && (
        <Suspense fallback={null}>
          <CyberGame isVisible={showGame} onClose={() => setShowGame(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default App 