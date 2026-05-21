import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Users, User, ArrowLeft, Monitor, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import PaintDecorations from './PaintDecorations';

interface Props {
  playerName: string;
  socket: Socket;
  onCreateParty: (mode: 'INDIVIDUAL' | 'GROUP', isSpectator: boolean) => void;
  onJoinParty: (code: string) => void;
  onBack: () => void;
}

export default function MainMenu({ playerName, socket, onCreateParty, onJoinParty, onBack }: Props) {
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'INDIVIDUAL' | 'GROUP' | null>(null);
  const [joinCode, setJoinCode] = useState('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleCreate = (isSpectator: boolean) => {
    if (selectedMode) {
       onCreateParty(selectedMode, isSpectator);
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const width = scrollContainerRef.current.offsetWidth;
      setActiveIndex(Math.round(scrollLeft / width));
    }
  };

  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({ left: index * width, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-transparent text-indigo-950 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
      <PaintDecorations />
      <div className="absolute top-0 left-0 w-full p-6 z-20 flex justify-start">
        <button onClick={onBack} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-600 font-black uppercase tracking-[0.2em] text-[10px] bg-white shadow-sm border border-indigo-50 px-5 py-3 rounded-full transition-all active:scale-95">
          <ArrowLeft size={14} /> KEMBALI
        </button>
      </div>

      <div className="w-full max-w-4xl z-10 flex flex-col items-center py-6 md:py-12 mt-4 md:mt-0">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center mb-6 md:mb-8"
          >
            <h1 className="text-5xl md:text-7xl font-black text-indigo-950 uppercase tracking-tighter drop-shadow-sm leading-[0.8] font-display italic">COLOR<br />HUNT</h1>
          </motion.div>
          
          <div className="relative w-full max-w-3xl">
            {activeIndex > 0 && (
              <button 
                onClick={() => scrollToIndex(activeIndex - 1)}
                className="absolute left-[-16px] top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl p-3 rounded-full md:hidden text-indigo-600 border border-indigo-50"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            
             {activeIndex < 1 && (
              <button 
                onClick={() => scrollToIndex(activeIndex + 1)}
                className="absolute right-[-16px] top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl p-3 rounded-full md:hidden text-indigo-600 border border-indigo-50"
              >
                <ChevronRight size={24} />
              </button>
            )}
 
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex w-full overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-2 gap-6 items-stretch [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-4 px-2"
            >
                {/* Create Party Card */}
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="min-w-full md:min-w-0 snap-center shrink-0 bg-white rounded-[40px] p-6 text-indigo-950 shadow-xl relative overflow-hidden flex flex-col border border-indigo-50 h-[370px] max-w-[320px] mx-auto"
                >
                  <h2 className="text-2xl font-black uppercase mb-1 font-display italic relative z-10 tracking-tighter text-center">BUAT PARTY</h2>
                  <h3 className="text-[11px] font-bold text-[#99a1af] uppercase tracking-widest mb-4 relative z-10 leading-relaxed text-center w-full">
                    Mulai kompetisi baru dan jadilah host permainan.
                  </h3>
                  
                  {!selectedMode ? (
                    <div className="space-y-4 flex-1 flex flex-col justify-start relative z-10 mt-2">
                       <label className="text-[12px] font-black text-indigo-950 uppercase tracking-[0.4em] block text-center mb-2">Pilih Tipe Kompetisi</label>
                       <div className="grid grid-cols-2 gap-4">
                         <button onClick={() => setSelectedMode('INDIVIDUAL')} className="bg-indigo-50/50 border-2 border-indigo-50 hover:border-indigo-500 hover:bg-white p-5 rounded-[28px] flex flex-col items-center gap-3 transition-all group scale-100 active:scale-95 shadow-sm">
                            <div className="bg-white p-4 rounded-xl shadow-sm text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                              <User size={28} />
                            </div>
                            <span className="font-black text-[11px] uppercase tracking-widest text-indigo-900">Solo</span>
                         </button>
                         <button onClick={() => setSelectedMode('GROUP')} className="bg-indigo-50/50 border-2 border-indigo-50 hover:border-blue-500 hover:bg-white p-5 rounded-[28px] flex flex-col items-center gap-3 transition-all group scale-100 active:scale-95 shadow-sm">
                            <div className="bg-white p-4 rounded-xl shadow-sm text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <Users size={28} />
                            </div>
                            <span className="font-black text-[11px] uppercase tracking-widest text-indigo-900">Tim</span>
                         </button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1 flex flex-col justify-center relative z-10">
                       <label className="text-[12px] font-black text-indigo-300 uppercase tracking-[0.4em] block text-center mb-1">Pilih Peran Host</label>
                       <div className="grid grid-cols-1 gap-2.5">
                         <button onClick={() => handleCreate(false)} className="bg-yellow-50/50 border-2 border-yellow-100 hover:border-yellow-400 hover:bg-white p-4 rounded-[24px] flex items-center gap-4 transition-all text-left shadow-sm group">
                            <div className="bg-yellow-400 p-3.5 rounded-xl text-yellow-950 shadow-md group-hover:scale-110 transition-transform"><User size={24} /></div>
                            <div>
                              <div className="font-black text-sm uppercase text-indigo-950 font-display italic leading-none mb-1">Pemain + Host</div>
                              <div className="text-[9px] font-black text-yellow-700 uppercase tracking-widest">Ikut Main Dari Sini</div>
                            </div>
                         </button>
                         <button onClick={() => handleCreate(true)} className="bg-indigo-50/50 border-2 border-indigo-100 hover:border-indigo-500 hover:bg-white p-4 rounded-[24px] flex items-center gap-4 transition-all text-left shadow-sm group">
                            <div className="bg-white border border-indigo-100 p-3.5 rounded-xl text-indigo-600 shadow-md group-hover:scale-110 transition-transform"><Monitor size={24} /></div>
                            <div>
                              <div className="font-black text-sm uppercase text-indigo-950 font-display italic leading-none mb-1">Layar Monitor</div>
                              <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Hanya Jadi Monitor</div>
                            </div>
                         </button>
                       </div>
                       <button onClick={() => setSelectedMode(null)} className="w-full text-center text-[10px] font-black text-indigo-300 mt-2 uppercase tracking-[0.2em] hover:text-indigo-600 transition-colors">Batal</button>
                    </div>
                  )}
                </motion.div>

                {/* Join Party Card */}
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="min-w-full md:min-w-0 snap-center shrink-0 bg-white rounded-[40px] p-6 text-indigo-950 shadow-xl relative overflow-hidden flex flex-col border border-indigo-50 h-[370px] max-w-[320px] mx-auto"
                >
                  <h2 className="text-2xl font-black uppercase mb-1 font-display italic relative z-10 tracking-tighter text-center">GABUNG PARTY</h2>
                  <h3 className="text-[11px] font-bold text-[#99a1af] uppercase tracking-widest mb-4 relative z-10 leading-relaxed text-center w-full">
                    Masukkan 6 digit kode dari host untuk bergabung.
                  </h3>
                  
                  <div className="space-y-4 flex-1 flex flex-col justify-center relative z-10">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.4em] block text-center">Masukkan Kode Room</label>
                      <input 
                        type="text" 
                        value={joinCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          if (val.length <= 6) setJoinCode(val);
                        }}
                        className="w-full bg-indigo-50/50 border-2 border-indigo-50 rounded-[24px] p-4 text-3xl font-black uppercase tracking-[0.4em] text-center focus:outline-none focus:border-indigo-500 shadow-inner placeholder:text-gray-200 transition-all font-mono"
                        placeholder="XXXXXX"
                        maxLength={6}
                      />
                    </div>
                    
                    <button 
                      onClick={() => joinCode.length === 6 && onJoinParty(joinCode)}
                      disabled={joinCode.length !== 6}
                      className="w-full bg-indigo-600 disabled:opacity-50 text-white font-black uppercase text-lg py-5 rounded-[28px] shadow-[0_15px_30px_-10px_rgba(79,70,229,0.4)] active:scale-95 transition-all hover:translate-y-[-2px] tracking-widest"
                    >
                      MASUK ROOM
                    </button>
                  </div>
                </motion.div>
            </div>
            
            {/* Dots Pagination (Mobile Only) */}
            <div className="flex justify-center gap-3 mt-4 md:hidden">
              <div className={`h-2 rounded-full transition-all ${activeIndex === 0 ? 'w-8 bg-indigo-600' : 'w-2 bg-indigo-200'}`} />
              <div className={`h-2 rounded-full transition-all ${activeIndex === 1 ? 'w-8 bg-indigo-600' : 'w-2 bg-indigo-200'}`} />
            </div>
          </div>
      </div>
    </div>
  );
}
