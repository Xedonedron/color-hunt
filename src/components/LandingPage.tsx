import { useState } from 'react';
import { Palette, Play } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onStart: (name: string) => void;
}

export default function LandingPage({ onStart }: Props) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleStart = () => {
    if (!username.trim()) {
      setError('Tolong isi username mu dulu!');
      setTimeout(() => setError(''), 3000);
      return;
    }
    onStart(username.trim());
  };

  return (
    <div className="h-[100dvh] bg-transparent text-indigo-900 flex flex-col items-center justify-between p-6 relative overflow-hidden font-sans">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {error && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white font-bold px-6 py-3 rounded-2xl z-50 shadow-lg"
          >
            {error}
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="z-10 w-full max-w-md flex flex-col items-center"
        >
          <div className="text-center mb-6 flex flex-col items-center">
            <motion.div 
              whileHover={{ rotate: 1 }}
              className="bg-white p-8 rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border-t-8 border-yellow-400 rotate-[-1deg] mb-6 inline-block relative"
            >
               {/* Ring Binder Effect */}
               <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-gray-200 border-2 border-gray-300" />
                  <div className="w-4 h-4 rounded-full bg-gray-200 border-2 border-gray-300" />
               </div>

              <h1 className="text-5xl sm:text-7xl font-black text-indigo-950 uppercase tracking-tighter leading-tight font-display pt-4">
                Color<br/><span className="text-indigo-600">Hunt</span>
              </h1>
            </motion.div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#686868]">Tangkap Warna di Sekitarmu</p>
          </div>

          <div className="w-full space-y-8 bg-white/40 backdrop-blur-md p-8 pb-[23px] rounded-[40px] border border-white/50 shadow-sm">
            <div className="space-y-4">
              <label className="text-xs font-black text-indigo-400 uppercase tracking-widest block pl-2">Siapa Namamu?</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                className="w-full bg-white border-4 border-indigo-50 rounded-[32px] p-6 text-2xl font-black text-center text-indigo-950 focus:outline-none focus:border-indigo-500 shadow-inner transition-all placeholder:text-indigo-100 uppercase"
                placeholder="NAMA KAMU"
                maxLength={15}
              />
            </div>

            <button 
              onClick={handleStart}
              className="w-full group relative flex items-center justify-center gap-3 bg-[#4f39f6] text-white p-6 rounded-[32px] shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Play size={24} fill="currentColor" />
              <span className="text-2xl font-black uppercase tracking-tight font-display">MULAI MAIN</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer Branding */}
      <div className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em] pb-[23px] pt-[10px]">
        Made by: Nixon Daniel Hutahaean
      </div>
    </div>
  );
}
