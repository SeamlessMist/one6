import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Calendar, Infinity, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from './types';
import { ARC_ORDER } from './constants';

const MAX_GUESSES = 10;

export default function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [targetChar, setTargetChar] = useState<Character | null>(null);
  const [mode, setMode] = useState<'daily' | 'unlimited'>('daily');
  const [guesses, setGuesses] = useState<Character[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const winSound = useRef<HTMLAudioElement | null>(null);
  const loseSound = useRef<HTMLAudioElement | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchCharacters = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/characters.json');
      if (!res.ok) throw new Error('Failed to fetch character data');
      const data = await res.json();
      setCharacters(data);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load characters:", err);
      setError("Failed to load character data. Please check your connection.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    winSound.current = new Audio('https://www.myinstants.com/media/sounds/luffy-laugh.mp3');
    loseSound.current = new Audio('https://www.myinstants.com/media/sounds/doflamingo-laugh.mp3');
    winSound.current.load();
    loseSound.current.load();
    
    fetchCharacters();
  }, []);

  useEffect(() => {
    if (characters.length > 0) {
      initGame();
    }
  }, [characters, mode]);

  const initGame = () => {
    // Stop any playing sounds
    if (winSound.current) {
      winSound.current.pause();
      winSound.current.currentTime = 0;
    }
    if (loseSound.current) {
      loseSound.current.pause();
      loseSound.current.currentTime = 0;
    }

    setGuesses([]);
    setGameOver(false);
    setWin(false);
    setSearchInput('');

    if (mode === 'daily') {
      const d = new Date();
      const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      const index = Math.floor((Math.abs(Math.sin(seed) * 10000) % 1) * characters.length);
      setTargetChar(characters[index]);
    } else {
      const randomChar = characters[Math.floor(Math.random() * characters.length)];
      setTargetChar(randomChar);
    }
  };

  const filteredMatches = useMemo(() => {
    if (!searchInput.trim()) return [];
    const guessedNames = guesses.map(g => g.name);
    return characters
      .filter(c => 
        c.name.toLowerCase().includes(searchInput.toLowerCase()) && 
        !guessedNames.includes(c.name)
      )
      .slice(0, 10);
  }, [searchInput, characters, guesses]);

  const handleGuess = async (char: Character) => {
    if (gameOver) return;

    const newGuesses = [char, ...guesses];
    setGuesses(newGuesses);
    setSearchInput('');
    setShowDropdown(false);

    if (char.name === targetChar?.name) {
      setWin(true);
      setGameOver(true);
      winSound.current?.play().catch(() => {});
      
      // Lazy load confetti
      const confettiModule = await import('canvas-confetti');
      confettiModule.default({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f2ff', '#4ade80', '#ff4444']
      });
    } else if (newGuesses.length >= MAX_GUESSES) {
      setGameOver(true);
      loseSound.current?.play().catch(() => {});
    }
  };

  const formatBounty = (b: string) => {
    const n = parseInt(b.replace(/[^0-9]/g, '')) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    return n > 0 ? n.toLocaleString() : "NONE";
  };

  const parseBounty = (b: string) => parseInt(b.replace(/[^0-9]/g, '')) || 0;

  const getMatchClass = (val: any, targetVal: any, type: 'exact' | 'partial' | 'none' = 'exact') => {
    if (val === targetVal) return 'match-exact';
    if (type === 'partial' && Array.isArray(val) && Array.isArray(targetVal)) {
      if (val.some(v => targetVal.includes(v))) return 'match-partial';
    }
    return 'match-none';
  };

  const getArrow = (val: number, targetVal: number) => {
    if (val === targetVal) return '';
    return val < targetVal ? ' ▲' : ' ▼';
  };

  const getArcArrow = (val: string, targetVal: string) => {
    const valIdx = ARC_ORDER.indexOf(val);
    const targetIdx = ARC_ORDER.indexOf(targetVal);
    if (valIdx === -1 || targetIdx === -1 || valIdx === targetIdx) return '';
    return valIdx < targetIdx ? ' ▲' : ' ▼';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505]">
        <div className="w-16 h-16 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_#00f2ff]" />
        <div className="text-xl font-mono uppercase tracking-[0.3em] text-neon-cyan animate-pulse">Initializing System...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-6 text-center">
        <div className="text-neon-red text-6xl mb-6 font-black uppercase tracking-tighter">System Error</div>
        <p className="text-white/60 font-mono mb-8 max-w-md">{error}</p>
        <button 
          onClick={fetchCharacters}
          className="px-8 py-3 bg-neon-cyan text-black font-bold uppercase tracking-widest rounded-lg hover:brightness-110 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans">
      {/* Background Layer - Using CSS background for better performance */}
      <div className="fixed inset-0 z-0 bg-black/40 pointer-events-none" />

      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col items-center pt-12 pb-24">
        {/* Technical Header */}
        <div className="w-full max-w-[650px] mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-8 bg-neon-cyan shadow-[0_0_10px_#00f2ff]" />
            <h1 className="text-5xl font-black tracking-tighter uppercase text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              ONE PIECE <span className="text-neon-cyan">DLE</span>
            </h1>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 ml-4">
            CHARACTER IDENTIFICATION SYSTEM // V2.0
          </p>
        </div>

        {/* Header Controls */}
        <div className="w-full max-w-[650px] flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 h-[56px]">
            <div className="glass-ui relative flex items-center p-1 rounded-lg overflow-hidden border-white/5">
              <motion.div 
                className="absolute top-1 bottom-1 bg-white/10 rounded-md"
                initial={false}
                animate={{ 
                  left: mode === 'daily' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)'
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
              <button 
                onClick={() => setMode('daily')}
                className={`relative z-10 flex-1 h-full flex items-center justify-center gap-2 transition-colors cursor-pointer ${mode === 'daily' ? 'text-neon-cyan' : 'text-white/30'}`}
              >
                <Calendar size={16} />
                <span className="font-mono tracking-widest uppercase font-bold text-[10px]">Daily</span>
              </button>
              <button 
                onClick={() => setMode('unlimited')}
                className={`relative z-10 flex-1 h-full flex items-center justify-center gap-2 transition-colors cursor-pointer ${mode === 'unlimited' ? 'text-neon-cyan' : 'text-white/30'}`}
              >
                <Infinity size={16} />
                <span className="font-mono tracking-widest uppercase font-bold text-[10px]">Unlimited</span>
              </button>
            </div>
            
            <div className="glass-ui flex items-center justify-center gap-4 rounded-lg border-white/5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">Attempts Left:</span>
              <span className="font-mono text-2xl font-bold text-neon-yellow tracking-tighter">
                {String(MAX_GUESSES - guesses.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full z-50">
            <div className="glass-ui flex items-center rounded-lg h-[64px] px-6 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <Search className="text-neon-cyan mr-4" size={20} />
              <input 
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => {
                  setShowDropdown(true);
                  // Unlock audio on first interaction
                  if (winSound.current) winSound.current.play().then(() => { winSound.current?.pause(); winSound.current!.currentTime = 0; }).catch(() => {});
                  if (loseSound.current) loseSound.current.play().then(() => { loseSound.current?.pause(); loseSound.current!.currentTime = 0; }).catch(() => {});
                }}
                disabled={gameOver}
                className="w-full bg-transparent border-none focus:outline-none text-white text-lg uppercase font-mono placeholder:text-white/40" 
                placeholder="ENTER CHARACTER NAME..." 
                type="text" 
                autoComplete="off"
              />
            </div>
            
            <AnimatePresence>
              {showDropdown && filteredMatches.length > 0 && (
                <motion.div 
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-[calc(100%+12px)] left-0 w-full glass-dropdown rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden max-h-[300px] overflow-y-auto hide-scroll border-white/10"
                >
                  {filteredMatches.map((char) => (
                    <div 
                      key={char.name}
                      onClick={() => handleGuess(char)}
                      className="dropdown-item flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer p-4 border-b border-white/5 last:border-none group"
                    >
                    <div className="w-10 h-10 rounded-md overflow-hidden border border-white/10 bg-black/50 group-hover:border-neon-cyan transition-colors">
                        <img 
                          src={char.image} 
                          alt={char.name} 
                          className="w-full h-full object-cover object-top"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('Straw_Hat_Pirates_Jolly_Roger.png')) {
                              target.src = 'https://static.wikia.nocookie.net/onepiece/images/a/a2/Straw_Hat_Pirates_Jolly_Roger.png';
                            }
                          }}
                        />
                      </div>
                      <span className="font-mono font-bold uppercase text-white group-hover:text-neon-cyan transition-colors">{char.name}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Game Board */}
        <div className="w-full mt-16 overflow-x-auto pb-8 hide-scroll">
          <div className="min-w-[1200px] flex flex-col gap-4 items-center">
            {/* Header Row */}
            <div className="w-full grid grid-cols-11 gap-3 mb-6 px-2 text-left font-mono uppercase tracking-[0.2em] text-[10px] text-white/60">
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Character</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Gender</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Species</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Role</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Group</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Fruit</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Haki</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Height</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Bounty</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Origin</div>
              <div className="flex items-center gap-2"><div className="w-1 h-3 bg-neon-cyan" />Debut</div>
            </div>

            {/* Guess Rows */}
            <AnimatePresence mode="popLayout">
              {guesses.map((g) => (
                <motion.div 
                  key={g.name}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full grid grid-cols-11 gap-3 px-2"
                >
                  {/* Character */}
                  <div className={`tile ${getMatchClass(g.name, targetChar?.name)} p-0 overflow-hidden border-white/5`}>
                    <div className="w-full h-full relative group">
                      <img 
                        src={g.image} 
                        alt={g.name} 
                        className="w-full h-full object-cover object-top filter grayscale-[0.2] group-hover:grayscale-0 transition-all"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('Straw_Hat_Pirates_Jolly_Roger.png')) {
                            target.src = 'https://static.wikia.nocookie.net/onepiece/images/a/a2/Straw_Hat_Pirates_Jolly_Roger.png';
                          }
                        }}
                      />
                    </div>
                  </div>
                  {/* Gender */}
                  <div className={`tile ${getMatchClass(g.gender, targetChar?.gender)}`}>
                    {g.gender}
                  </div>
                  {/* Species */}
                  <div className={`tile ${getMatchClass(g.species, targetChar?.species)}`}>
                    {g.species}
                  </div>
                  {/* Calling */}
                  <div className={`tile ${getMatchClass(g.calling, targetChar?.calling)}`}>
                    {g.calling}
                  </div>
                  {/* Affiliation */}
                  <div className={`tile ${getMatchClass(g.affiliation, targetChar?.affiliation)}`}>
                    {g.affiliation}
                  </div>
                  {/* Fruit */}
                  <div className={`tile ${getMatchClass(g.devilFruitType, targetChar?.devilFruitType)}`}>
                    {g.devilFruitType}
                  </div>
                  {/* Haki */}
                  <div className={`tile ${getMatchClass(g.haki, targetChar?.haki, 'partial')}`}>
                    {g.haki.length === 0 || g.haki[0] === 'None' ? 'NONE' : g.haki.map(h => h.substring(0, 3)).join('/')}
                  </div>
                  {/* Height */}
                  <div className={`tile ${getMatchClass(g.heightCm, targetChar?.heightCm)}`}>
                    {g.heightCm}cm{getArrow(g.heightCm, targetChar?.heightCm || 0)}
                  </div>
                  {/* Bounty */}
                  <div className={`tile ${getMatchClass(parseBounty(g.bounty), parseBounty(targetChar?.bounty || '0'))}`}>
                    {formatBounty(g.bounty)}{getArrow(parseBounty(g.bounty), parseBounty(targetChar?.bounty || '0'))}
                  </div>
                  {/* Origin */}
                  <div className={`tile ${getMatchClass(g.seaOfBirth, targetChar?.seaOfBirth)}`}>
                    {g.seaOfBirth}
                  </div>
                  {/* Debut */}
                  <div className={`tile ${getMatchClass(g.firstArc, targetChar?.firstArc)}`}>
                    {g.firstArc}{getArcArrow(g.firstArc, targetChar?.firstArc || '')}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* End Game Modal */}
      <AnimatePresence>
        {gameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-ui border border-white/10 rounded-xl p-10 max-w-3xl w-full shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-neon-cyan shadow-[0_0_15px_#00f2ff]" />
              <button 
                onClick={() => setGameOver(false)}
                className="absolute top-6 right-6 text-white/20 hover:text-neon-cyan transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-neon-cyan" />
                <h2 className="text-3xl font-black uppercase tracking-tighter text-white">
                  MISSION <span className={win ? 'text-neon-cyan' : 'text-neon-red'}>{win ? 'ACCOMPLISHED' : 'FAILED'}</span>
                </h2>
              </div>
              
              <div className="flex flex-col md:flex-row items-stretch gap-8 mb-10">
                <div className="w-56 h-72 rounded-lg overflow-hidden border border-white/10 bg-black/40 shadow-2xl">
                  <img 
                    src={targetChar?.image} 
                    alt={targetChar?.name} 
                    className="w-full h-full object-cover object-top"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('Straw_Hat_Pirates_Jolly_Roger.png')) {
                        target.src = 'https://static.wikia.nocookie.net/onepiece/images/a/a2/Straw_Hat_Pirates_Jolly_Roger.png';
                      }
                    }}
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-6">{targetChar?.name}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { l: 'GENDER', v: targetChar?.gender },
                        { l: 'SPECIES', v: targetChar?.species },
                        { l: 'ROLE', v: targetChar?.calling },
                        { l: 'GROUP', v: targetChar?.affiliation },
                        { l: 'FRUIT', v: targetChar?.devilFruitType },
                        { l: 'HEIGHT', v: targetChar?.heightCm + 'CM' },
                        { l: 'BOUNTY', v: formatBounty(targetChar?.bounty || '0') },
                        { l: 'DEBUT', v: targetChar?.firstArc }
                      ].map(s => (
                        <div key={s.l} className="modal-stat-box">
                          <span className="modal-stat-label">{s.l}</span>
                          <span className="modal-stat-value">{s.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 text-left font-mono text-[11px] text-white/40 uppercase tracking-widest">
                  {win ? `Target identified in ${guesses.length} cycles.` : `Target escaped. Identification: ${targetChar?.name}.`}
                </div>
                <button 
                  onClick={initGame}
                  className="px-10 py-4 rounded-lg bg-neon-cyan text-black font-black tracking-widest uppercase hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  REBOOT SYSTEM
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
