import { Socket } from 'socket.io-client';
import { Room } from '../../server';
import { Users, Clock, Trophy, ArrowLeft, UserX, User, Scale, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import PaintDecorations from './PaintDecorations';
import { getRandomHTMLColor } from '../utils/htmlColors';

interface Props {
  socket: Socket;
  roomData: Room;
  roomId: string;
  playerName: string;
  playerId: string;
  onBack: () => void;
}

function TargetStageReveal({ roomData, onComplete }: { roomData: Room; onComplete: () => void }) {
  const [isSpinning, setIsSpinning] = useState(true);
  const [displayHex, setDisplayHex] = useState('#FFFFFF');
  const [displayName, setDisplayName] = useState('???');
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    let timeInterval: NodeJS.Timeout;
    if (roomData.endTime) {
      const timeOffset = roomData.serverTime ? Date.now() - roomData.serverTime : 0;
      
      const updateTimer = () => {
        const now = Date.now() - timeOffset;
        let remaining = Math.ceil((roomData.endTime! - now) / 1000);
        if (remaining < 0) remaining = 0;
        setTimeLeft(remaining);
      };

      updateTimer();
      timeInterval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(timeInterval);
  }, [roomData.endTime, roomData.serverTime]);

  let interval: NodeJS.Timeout;

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isSpinning) {
      interval = setInterval(() => {
        const randomColor = getRandomHTMLColor();
        setDisplayHex(randomColor.hex);
        setDisplayName(randomColor.name);
      }, 80);

      timeout = setTimeout(() => {
         clearInterval(interval);
         setIsSpinning(false);
         setDisplayHex(roomData.targetColor?.hex || '#FFFFFF');
         setDisplayName(roomData.targetColor?.name || 'Warna Target');
         onComplete();
      }, 5000); // 5 seconds of spinning
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSpinning, roomData.targetColor?.hex]);

  return (
    <div className="min-h-screen bg-transparent text-indigo-900 flex flex-col items-center justify-center p-8 font-sans overflow-hidden">
      <PaintDecorations />
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-12">
          <div className="bg-white p-3 px-6 rounded-2xl shadow-sm border-t-4 border-yellow-400 rotate-[-1deg] inline-block mb-4">
            <span className="text-indigo-950 font-black text-2xl tracking-tighter font-display uppercase">TARGET REVEAL</span>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400">Siapkan Matamu!</p>
        </div>

        <div className="relative group">
           {/* Card Stack Effect */}
           <div className="absolute inset-0 bg-gray-200 rounded-[50px] translate-y-4 rotate-2" />
           <div className="absolute inset-0 bg-gray-100 rounded-[50px] translate-y-2 translate-x-1 -rotate-1" />
           
           <motion.div 
             animate={isSpinning ? { rotateX: [0, 90, 0] } : { scale: [1, 1.05, 1] }}
             transition={isSpinning ? { duration: 0.1, repeat: Infinity } : { type: "spring", stiffness: 300, damping: 10 }}
             className="relative bg-white p-6 rounded-[50px] shadow-2xl border-b-[12px] border-gray-100 flex flex-col items-center gap-8"
           >
             {/* Mechanical Binder Holes */}
             <div className="flex gap-12 mb-4">
                <div className="w-6 h-6 rounded-full bg-gray-100 border-4 border-gray-200 shadow-inner" />
                <div className="w-6 h-6 rounded-full bg-gray-100 border-4 border-gray-200 shadow-inner" />
             </div>

             <div 
               className="w-64 h-64 rounded-[40px] shadow-inner transition-colors duration-75 relative overflow-hidden" 
               style={{ backgroundColor: displayHex }}
             >
                {isSpinning && (
                  <motion.div 
                    animate={{ y: ['-100%', '100%'] }}
                    transition={{ duration: 0.2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent"
                  />
                )}
             </div>

             <div className="text-center h-20 flex flex-col justify-center">
               <h2 className={`text-4xl font-black font-display tracking-tight uppercase ${isSpinning ? 'blur-sm opacity-50' : 'blur-0 opacity-100'}`}>
                 {displayName}
               </h2>
             </div>
           </motion.div>

           {!isSpinning && (
             <motion.div
               initial={{ scale: 0 }}
               animate={{ scale: 1 }}
               className="absolute -top-6 -right-6 bg-yellow-400 text-indigo-900 font-black p-4 px-6 rounded-full shadow-lg rotate-12 z-20"
             >
               SIAP?
             </motion.div>
           )}
        </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-white/50 backdrop-blur-sm p-4 px-8 rounded-full shadow-sm border border-indigo-50"
          >
             <span className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mr-4">{isSpinning ? 'Mengacak...' : 'Waktu Menghafal'}</span>
             <span className="text-2xl font-black font-mono text-indigo-950">{timeLeft}s</span>
          </motion.div>
      </motion.div>
    </div>
  );
}

function ScoreTicker({ endValue }: { endValue: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = endValue / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= endValue) {
        setCount(endValue);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [endValue]);

  return <span>{count}</span>;
}

export default function HostView({ socket, roomData, roomId, playerName, playerId, onBack }: Props) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [displayStage, setDisplayStage] = useState(roomData.stage);
  const [showCurtain, setShowCurtain] = useState(false);

  useEffect(() => {
    // If the server tells us it's REVEAL but we are in HUNT, we do a curtain transition
    if (roomData.stage === 'REVEAL' && displayStage === 'HUNT') {
      setShowCurtain(true);
      setTimeout(() => {
        setDisplayStage('REVEAL');
        setTimeout(() => setShowCurtain(false), 800);
      }, 1500); // show curtain for 1.5s before revealing
    } else if (roomData.stage !== displayStage) {
      setDisplayStage(roomData.stage);
    }
  }, [roomData.stage, displayStage]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if ((displayStage === 'HUNT' || displayStage === 'TARGET') && roomData.endTime) {
      const timeOffset = roomData.serverTime ? Date.now() - roomData.serverTime : 0;
      
      const updateTimer = () => {
        const now = Date.now() - timeOffset;
        let remaining = Math.ceil((roomData.endTime! - now) / 1000);
        if (remaining < 0) remaining = 0;
        setTimeLeft(remaining);
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [displayStage, roomData.endTime, roomData.serverTime]);

  const players = Object.values(roomData.players);
  const redTeam = players.filter(p => p.team === 'Red');
  const blueTeam = players.filter(p => p.team === 'Blue');

  const getTeamScore = (team: 'Red' | 'Blue') => {
    return players.filter(p => p.team === team).reduce((acc, curr) => acc + curr.score, 0);
  };

  const handleKick = (targetId: string) => {
    if (confirm('Tendang pemain ini?')) {
       socket.emit('kick_player', { roomId, targetPlayerId: targetId, playerId });
    }
  };

  const handleForceBalance = () => {
     socket.emit('force_balance', { roomId, playerId });
  };

  const renderCurtain = () => (
    <AnimatePresence>
      {showCurtain && (
        <motion.div
           initial={{ y: '-100%' }}
           animate={{ y: 0 }}
           exit={{ y: '100%' }}
           transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
           className="fixed inset-0 z-50 bg-indigo-950 flex flex-col items-center justify-center"
        >
           <motion.div
             animate={{ scale: [1, 1.2, 1] }}
             transition={{ duration: 1, repeat: Infinity }}
             className="text-8xl font-black text-yellow-400 mb-8 italic"
           >
             WAKTU HABIS!
           </motion.div>
           <div className="text-indigo-200 font-bold uppercase tracking-[0.3em]">Menghitung Skor...</div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (displayStage === 'FINAL_LEADERBOARD') {
    const finalSortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winners = finalSortedPlayers.slice(0, 3);
    
    return (
      <>
        {renderCurtain()}
        <div className="min-h-screen bg-transparent text-indigo-900 flex flex-col items-center justify-center p-8 font-sans overflow-hidden relative">
        <PaintDecorations />
        <div className="absolute top-0 right-0 p-8 md:p-12 text-indigo-50 font-black text-6xl md:text-8xl leading-[0.8] select-none uppercase z-0 font-display italic mix-blend-multiply opacity-30">JUARA</div>
        
        <div className="bg-white/80 backdrop-blur-md rounded-[60px] p-8 md:p-12 max-w-5xl w-full text-indigo-950 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.2)] relative z-10 flex flex-col items-center border border-white/50">
           <Trophy size={80} className="text-yellow-400 mb-8" />
           <h1 className="text-5xl md:text-7xl font-black text-center font-display italic tracking-tighter uppercase mb-12">Puncak Klasemen</h1>

           {roomData.mode === 'GROUP' && (
              <div className="flex justify-center items-center gap-8 md:gap-16 mb-16 w-full max-w-3xl">
                 <div className="text-center p-8 bg-red-50 rounded-[40px] border border-red-100 flex-1">
                    <div className="text-sm font-black uppercase tracking-widest text-red-500 mb-2">TIM MERAH</div>
                    <div className="text-5xl md:text-7xl font-black font-display italic text-red-600">{getTeamScore('Red')}</div>
                 </div>
                 <div className="text-4xl font-black italic text-indigo-200">VS</div>
                 <div className="text-center p-8 bg-blue-50 rounded-[40px] border border-blue-100 flex-1">
                    <div className="text-sm font-black uppercase tracking-widest text-blue-500 mb-2">TIM BIRU</div>
                    <div className="text-5xl md:text-7xl font-black font-display italic text-blue-600">{getTeamScore('Blue')}</div>
                 </div>
              </div>
           )}

           <div className="flex flex-wrap items-end justify-center gap-12 mb-16 px-4">
              {winners.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 50, rotate: i === 0 ? 0 : i === 1 ? -5 : 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.2, type: "spring" }}
                  className={`flex flex-col items-center ${i === 0 ? 'order-2 scale-110 mb-4' : i === 1 ? 'order-1' : 'order-3'}`}
                >
                  <div className={`polaroid-frame relative ${i === 0 ? 'bg-yellow-50' : ''}`}>
                    <div className="w-32 h-32 md:w-40 md:h-40 bg-gray-100 mb-4 overflow-hidden rounded-[30px] flex items-center justify-center shadow-lg border-4 border-white">
                       {p.lastImage ? (
                         <img src={p.lastImage} alt="Winner" className="w-full h-full object-cover" />
                       ) : (
                         <div className={`w-full h-full flex items-center justify-center text-4xl shadow-inner ${p.team === 'Red' ? 'bg-red-500' : 'bg-blue-500'}`}>
                            <User size={80} className="text-white/30" />
                         </div>
                       )}
                    </div>
                    <div className="text-center">
                       <div className="font-black italic text-xl uppercase tracking-tighter font-display">{p.name}</div>
                       <div className="text-xs font-bold text-gray-400">SKOR: {p.score}</div>
                    </div>
                    {i === 0 && <div className="absolute -top-4 -right-4 bg-yellow-400 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-xl border-4 border-white rotate-12">1</div>}
                  </div>
                </motion.div>
              ))}
           </div>

           <div className="w-full max-w-2xl bg-indigo-50/50 p-8 rounded-[40px] border border-indigo-100 flex flex-col items-center">
             <div className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-6">Klasemen Final</div>
             <div className="w-full space-y-2">
                {finalSortedPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between py-2 border-b border-indigo-100/30 last:border-0 opacity-80 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-4">
                       <span className="font-mono font-black text-indigo-300 w-6">#{index + 1}</span>
                       <span className="font-black text-indigo-950 uppercase tracking-tight">{player.name}</span>
                    </div>
                    <span className="font-black font-display italic text-indigo-600">{player.score} PTS</span>
                  </div>
                ))}
             </div>
           </div>

            <div className="flex gap-4">
              <button 
                onClick={() => socket.emit('new_game', { roomId, playerId })}
                className="mt-12 group relative flex items-center justify-center gap-3 bg-indigo-600 text-white p-6 px-12 rounded-[32px] shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="text-xl font-black uppercase tracking-tight font-display text-center w-full">MAIN LAGI</span>
              </button>
            </div>
        </div>
      </div>
      </>
    );
  }

  if (displayStage === 'REVEAL') {
    const sortedPlayers = [...players].sort((a, b) => (b.lastScore || 0) - (a.lastScore || 0)); // high to low
    
    return (
        <div className="min-h-screen bg-transparent text-indigo-900 p-8 font-sans flex flex-col overflow-x-hidden">
          <PaintDecorations />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-4">
             <div className="flex items-center gap-4">
               <div className="bg-white p-3 px-6 rounded-2xl shadow-sm border-t-4 border-indigo-600 rotate-[-1deg] relative z-10">
                  <span className="text-indigo-950 font-black text-2xl tracking-tighter font-display uppercase">HASIL PERBURUAN</span>
                </div>
                <div className="bg-indigo-100 px-4 py-2 rounded-full border border-indigo-100 relative z-10">
                  <span className="text-indigo-600 font-mono font-black tracking-widest uppercase">RONDE {roomData.round}/{roomData.maxRounds}</span>
                </div>
             </div>
              <div className="flex gap-3 relative z-10">
              <button 
                onClick={() => socket.emit('new_game', { roomId, playerId })}
                className="bg-white hover:bg-gray-100 text-indigo-600 px-6 py-4 rounded-[24px] font-black uppercase tracking-widest text-sm transition-all shadow-sm border border-gray-100"
              >
                Lobby
              </button>
              <button 
                onClick={() => socket.emit('next_round', { roomId, playerId })}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-[24px] font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl font-display"
              >
                {roomData.round >= roomData.maxRounds ? 'KLASEMEN AKHIR' : 'RONDE BERIKUTNYA'}
              </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full items-start">
           {/* Left Section: Target Info */}
           <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
              <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 flex flex-col items-center relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />
                 <div className="text-xs font-black text-indigo-300 uppercase tracking-[0.3em] mb-6">Warna Target</div>
                 <div 
                   className="w-48 h-48 rounded-[40px] border-[12px] border-indigo-50 shadow-inner mb-6"
                   style={{ backgroundColor: roomData.targetColor?.hex }}
                 />
                 <h2 className="text-3xl font-black text-center font-display tracking-tight uppercase">{roomData.targetColor?.name}</h2>
              </div>

              <div className="bg-indigo-600 text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Trophy size={80} />
                 </div>
                 {roomData.mode === 'GROUP' && (
                   <div className="relative z-10">
                      <div className="text-xs font-bold text-indigo-200 uppercase tracking-[0.2em] mb-4">Skor Kumulatif Tim</div>
                      <div className="flex justify-between items-center gap-4">
                         <div className="text-center">
                            <div className="text-4xl font-black font-display italic tracking-tighter">{getTeamScore('Red')}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-red-300">RED TEAM</div>
                         </div>
                         <div className="w-px h-10 bg-white/20" />
                         <div className="text-center">
                            <div className="text-4xl font-black font-display italic tracking-tighter">{getTeamScore('Blue')}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-blue-300">BLUE TEAM</div>
                         </div>
                      </div>
                   </div>
                 )}
              </div>
           </div>

           {/* Right Section: Player Rankings */}
           <div className="lg:col-span-2 space-y-4">
              <div className="flex items-end justify-between mb-2 px-6">
                 <div className="text-xs font-black text-indigo-300 uppercase tracking-widest">Papan Skor Sesi Ini</div>
                 <div className="text-[10px] font-bold text-gray-400 uppercase italic">Urutan: Terbesar ke Terkecil</div>
              </div>
              
              <div className="flex flex-col gap-4">
                <AnimatePresence>
                  {sortedPlayers.map((player, index) => {
                    const isFirst = index === 0;
                    const isPodium = index === 1 || index === 2;
                    const rank = index + 1;
                    
                    return (
                      <motion.div 
                        key={player.id}
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: index * 0.3, type: "spring" }}
                        className={`group relative overflow-hidden flex flex-col md:flex-row items-center justify-between p-4 rounded-[30px] border transition-all shadow-sm ${
                          player.team === 'Red' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                        } ${isFirst ? 'p-8 scale-[1.02] shadow-xl z-20 mb-6 bg-yellow-50 border-yellow-200' : isPodium ? 'p-6 mb-2 bg-white' : 'px-8 bg-white'}`}
                      >
                        {/* Content */}
                        <div className={`flex flex-col md:flex-row text-center md:text-left items-center gap-6 w-full ${isFirst ? 'md:w-3/4' : ''}`}>
                          <div className={`flex items-center justify-center shrink-0 font-black rounded-2xl bg-white shadow-sm border border-gray-100 ${
                             isFirst ? 'w-16 h-16 text-3xl text-yellow-500 border-yellow-300' : 
                             isPodium ? 'w-14 h-14 text-2xl text-indigo-900 border-indigo-200' : 
                             'w-12 h-12 text-xl text-indigo-900'
                          }`}>
                            #{rank}
                          </div>
                          
                          {player.lastImage ? (
                             <div className="relative shrink-0">
                                <img src={player.lastImage} alt="Capture" className={`rounded-[30px] object-cover border-[6px] border-white shadow-lg ${
                                  isFirst ? 'w-48 h-48 md:w-64 md:h-64 border-yellow-100' : 
                                  isPodium ? 'w-32 h-32 md:w-40 md:h-40' : 
                                  'w-16 h-16 rounded-2xl border-4'
                                }`} />
                                <div className={`absolute border-[3px] border-white flex items-center justify-center font-black shadow-lg transform rotate-12 ${
                                  isFirst ? '-top-4 -right-4 bg-yellow-400 text-indigo-900 w-20 h-20 text-3xl rounded-full' : 
                                  isPodium ? '-top-3 -right-3 bg-indigo-600 text-white w-14 h-14 text-xl rounded-full' : 
                                  '-top-3 -right-3 bg-indigo-600 text-white w-10 h-10 text-xs rounded-full'
                                }`}>
                                  <ScoreTicker endValue={player.lastScore || 0} />
                                </div>
                             </div>
                          ) : (
                            <div className={`rounded-[30px] bg-gray-200 border-2 border-dashed border-gray-300 flex items-center justify-center font-black text-gray-400 uppercase text-center leading-tight ${
                              isFirst ? 'w-48 h-48 md:w-64 md:h-64 text-xl' : 
                              isPodium ? 'w-32 h-32 md:w-40 md:h-40 text-sm' : 
                              'w-16 h-16 text-[10px] rounded-2xl'
                            }`}>Belum Memotret</div>
                          )}
                          
                          <div className={`flex-1 flex flex-col items-center md:items-start`}>
                             <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
                                <span className={`font-black uppercase tracking-tighter text-indigo-950 font-display ${isFirst ? 'text-4xl' : isPodium ? 'text-2xl' : 'text-xl'}`}>{player.name}</span>
                                {player.lastGrade && (
                                  <span className={`font-black rounded-full shadow-sm border ${
                                    isFirst ? 'text-sm px-3 py-1' : isPodium ? 'text-xs px-2 py-0.5' : 'text-[10px] px-2 py-0.5'
                                  } ${
                                    player.lastGrade === 'Perfect' ? 'bg-yellow-400 text-indigo-900 border-yellow-500 hover:scale-110 transition-transform' : 
                                    player.lastGrade === 'Great' ? 'bg-green-100 text-green-600 border-green-200' : 
                                    'bg-gray-100 text-gray-400 border-gray-200'
                                  }`}>
                                    {player.lastGrade}!
                                  </span>
                                )}
                             </div>
                             <div className={`font-bold uppercase tracking-widest mt-1 opacity-80 ${isFirst ? 'text-sm' : 'text-[10px]'} ${player.team === 'Red' ? 'text-red-500' : 'text-blue-500'}`}>
                                {player.team === 'Red' ? 'Red Force' : 'Blue Guardians'}
                             </div>
                          </div>
                        </div>
                        
                        {/* Score display */}
                        <div className={`flex items-center shrink-0 mt-6 md:mt-0 ${isFirst ? 'w-full md:w-auto justify-center md:justify-end md:ml-auto md:border-l md:border-indigo-100 md:pl-8' : ''}`}>
                           <div className={`text-center md:text-right min-w-[100px]`}>
                             <div className={`font-black font-display italic tracking-tighter text-indigo-950 ${isFirst ? 'text-7xl md:text-8xl text-indigo-600' : isPodium ? 'text-5xl text-indigo-900' : 'text-4xl'}`}>
                               <ScoreTicker endValue={roomData.mode === 'GROUP' ? player.score : (player.lastScore || 0)} />
                             </div>
                             <div className={`${isFirst ? 'text-xs md:text-sm' : 'text-[10px]'} font-black text-indigo-400 tracking-widest uppercase`}>
                               {roomData.mode === 'GROUP' ? (isFirst ? 'TOTAL POIN SEMENTARA' : 'TOTAL POIN') : 'NILAI RONDE INI'}
                             </div>
                           </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
              
              {players.length === 0 && (
                <div className="bg-white/50 backdrop-blur-sm border-2 border-dashed border-gray-200 p-20 rounded-[40px] text-center">
                   <div className="text-gray-300 font-black text-xl uppercase tracking-widest">Belum ada pemain</div>
                </div>
              )}
           </div>
        </div>
      </div>
    );
  }

  if (displayStage === 'TARGET') {
    return (
      <TargetStageReveal 
        roomData={roomData} 
        onComplete={() => {}} // Could trigger client-side start if needed, but server handles timing
      />
    );
  }

  if (displayStage === 'HUNT') {
    return (
      <>
        {renderCurtain()}
        <div className="min-h-screen bg-transparent text-indigo-900 p-8 font-sans flex flex-col overflow-x-hidden">
        <PaintDecorations />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 z-20 relative gap-4">
          <div className="flex items-center gap-4 flex-wrap">
             <button onClick={onBack} className="bg-white hover:bg-gray-100 p-3 rounded-full mr-2 transition-colors shadow-sm border border-gray-200">
                 <ArrowLeft size={20} className="text-indigo-600" />
             </button>
            <div className="bg-white p-3 px-6 rounded-2xl shadow-sm border-t-4 border-yellow-400 rotate-[-1deg]">
              <span className="text-indigo-950 font-black text-xl md:text-2xl tracking-tighter font-display uppercase">COLOR HUNT</span>
            </div>
            <div className="bg-indigo-600 px-4 py-2 rounded-full shadow-lg">
              <span className="text-indigo-100 text-sm font-bold uppercase tracking-widest">ROOM:</span> <span className="font-mono font-black text-white text-lg ml-1 tracking-widest">{roomId}</span>
            </div>
          </div>
          <div className="bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm flex gap-4 self-end md:self-center">
            <span className="text-xs font-black uppercase text-indigo-400 tracking-widest">{players.length}/{roomData.maxPlayers} Pemain Terhubung</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-[48px] w-full max-w-6xl mx-auto p-8 md:p-12 flex flex-col items-center justify-between text-indigo-950 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden">
           <div className="absolute -top-2 -right-4 p-8 md:p-12 text-indigo-50 font-black text-7xl md:text-9xl select-none uppercase leading-[0.8] font-display italic mix-blend-multiply opacity-30">HUNT</div>
           
           <div className="text-center z-10 flex-1 flex flex-col items-center justify-center w-full">
             <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-indigo-50 px-8 py-3 rounded-full mb-8"
             >
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-indigo-400">
                  Ingat Warnanya!
                </h2>
             </motion.div>
             
             <div className="flex flex-col items-center">
               <motion.h1 
                 animate={{ scale: [1, 1.05, 1], opacity: [1, 0.4, 1] }}
                 transition={{ duration: 2, repeat: Infinity }}
                 className="text-6xl md:text-8xl font-black mb-12 italic text-center font-display tracking-tighter text-indigo-100"
               >
                 MEMORIZE!
               </motion.h1>
               
               <div className="relative">
                  <div 
                    className="w-64 h-64 md:w-80 md:h-80 rounded-[60px] border-[16px] border-indigo-50 flex items-center justify-center relative shadow-xl z-10 bg-indigo-50/30"
                  >
                     <Clock size={100} className="text-indigo-100" />
                  </div>
                  <div className="absolute inset-0 bg-black/5 blur-2xl rounded-[60px] translate-y-10 scale-90" />
               </div>
             </div>
           </div>
           
           {/* Timer Section */ }
           <motion.div 
             initial={{ opacity: 0, y: 50 }}
             animate={{ opacity: 1, y: 0 }}
             className="w-full max-w-2xl bg-white p-8 rounded-[40px] flex items-center justify-between border border-gray-100 z-10 mt-12 shadow-xl"
           >
             <div className="text-left flex-1 pl-4">
               <div className="text-xs font-black text-indigo-300 uppercase tracking-[0.3em] mb-2">Sisa Waktu</div>
               <div className={`text-6xl md:text-7xl font-black font-mono tracking-tighter transition-colors duration-300 ${timeLeft <= 5 ? 'text-pink-500 animate-pulse' : 'text-indigo-950'}`}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </div>
             </div>
             <div className="w-px h-20 bg-gray-100 mx-8"></div>
             <div className="text-right flex-1 pr-4">
               <div className="text-xs font-black text-indigo-300 uppercase tracking-[0.3em] mb-2">Fase</div>
               <div className="text-3xl md:text-4xl font-black text-indigo-600 uppercase font-display italic">
                 HUNTING!
               </div>
             </div>
           </motion.div>
        </div>
      </div>
      </>
    );
  }

  // LOBBY STAGE
  return (
    <>
      {renderCurtain()}
      <div className="min-h-screen bg-indigo-600 text-white p-6 md:p-8 font-sans flex flex-col overflow-y-auto overflow-x-hidden relative">
        <PaintDecorations />
        <div className="max-w-6xl w-full mx-auto flex flex-col min-h-[calc(100vh-4rem)] relative z-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 md:mb-12 gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={onBack} className="bg-indigo-800/50 hover:bg-indigo-700/50 p-3 rounded-full transition-colors mr-2">
                 <ArrowLeft size={24} />
            </button>
            <div className="bg-yellow-400 p-3 rounded-2xl shadow-lg rotate-[-2deg]">
              <span className="text-indigo-900 font-black flex items-center h-full text-xl md:text-3xl tracking-tighter uppercase mb-0 leading-none">Color Hunt</span>
            </div>
            <div className="bg-indigo-800/50 px-4 md:px-6 py-2 md:py-3 rounded-full border-2 border-indigo-400 flex items-center">
              <span className="text-indigo-200 text-sm md:text-lg font-bold pr-2">ROOM:</span>
              <span className="font-mono font-black text-xl md:text-2xl tracking-wider">{roomId}</span>
            </div>
          </div>
          
          <div className="flex flex-row items-center justify-between w-full md:w-auto gap-4">
            {roomData.mode === 'GROUP' && (
                <button onClick={handleForceBalance} className="bg-pink-500 hover:bg-pink-400 text-white px-4 md:px-6 py-2 md:py-3 rounded-full font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg transition-colors whitespace-nowrap text-sm">
                    <Scale size={16} className="md:w-5 md:h-5" /> Seimbangkan Tim
                </button>
            )}
            <div className="bg-white/10 px-4 md:px-6 py-2 md:py-3 rounded-full backdrop-blur-md border border-white/20">
               <span className="text-sm md:text-lg opacity-80 uppercase tracking-widest font-bold flex items-center gap-2 whitespace-nowrap">
                 <Users size={16} className="md:w-6 md:h-6"/> {players.length}/{roomData.maxPlayers}
               </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0 overflow-hidden">
          <div className="flex-[2] flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden">
            {roomData.mode === 'GROUP' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                {/* Team Red */}
                <div className="bg-indigo-900/40 rounded-[40px] p-8 border-4 border-pink-500 shadow-2xl flex flex-col relative overflow-hidden">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-pink-500/30 z-10">
                    <h2 className="text-[36px] font-black uppercase text-pink-500">Tim Merah</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {redTeam.map(p => (
                      <div key={p.id} className="bg-white p-4 rounded-2xl flex items-center justify-between text-indigo-950 shadow-md">
                        <span className="font-black text-xl flex items-center gap-2">
                          {p.name} {p.id === playerId && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded uppercase tracking-widest">Anda (Host)</span>}
                        </span>
                        <div className="flex gap-4 items-center">
                           {p.id !== playerId && (
                               <button onClick={() => handleKick(p.id)} className="text-red-400 hover:text-red-600 p-1">
                                   <UserX size={18} />
                               </button>
                           )}
                        </div>
                      </div>
                    ))}
                    {redTeam.length === 0 && <div className="text-center opacity-40 font-bold uppercase pt-8 text-indigo-200">Menunggu pemain...</div>}
                  </div>
                </div>

                {/* Team Blue */}
                <div className="bg-indigo-900/40 rounded-[40px] p-8 border-4 border-cyan-400 shadow-2xl flex flex-col relative overflow-hidden">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-cyan-400/30 z-10">
                    <h2 className="text-[37px] font-black uppercase text-cyan-400">Tim Biru</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {blueTeam.map(p => (
                      <div key={p.id} className="bg-white p-4 rounded-2xl flex items-center justify-between text-indigo-950 shadow-md">
                        <span className="font-black text-xl flex items-center gap-2">
                            {p.name} {p.id === playerId && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded uppercase tracking-widest">Anda (Host)</span>}
                        </span>
                        <div className="flex gap-4 items-center">
                           {p.id !== playerId && (
                               <button onClick={() => handleKick(p.id)} className="text-red-400 hover:text-red-600 p-1">
                                   <UserX size={18} />
                               </button>
                           )}
                        </div>
                      </div>
                    ))}
                    {blueTeam.length === 0 && <div className="text-center opacity-40 font-bold uppercase pt-8 text-indigo-200">Menunggu pemain...</div>}
                  </div>
                </div>
              </div>
            ) : (
                <div className="flex-1 min-h-0 bg-indigo-900/40 border border-indigo-400/30 p-8 rounded-[40px] shadow-2xl flex flex-col relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 text-indigo-100/5 font-black text-[12rem] select-none uppercase leading-none">PEMAIN</div>
                   <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-indigo-400/30 z-10">
                      <h2 className="text-3xl font-black uppercase text-indigo-100">Daftar Pemain</h2>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto z-10 grid grid-cols-1 lg:grid-cols-2 gap-4 content-start">
                       {players.map(p => (
                           <div key={p.id} className="bg-white p-4 rounded-2xl flex items-center justify-between text-indigo-950 shadow-md">
                               <div className="flex items-center gap-3">
                                   <div className="bg-indigo-100 p-2 rounded-full text-indigo-500">
                                       <User size={20} />
                                   </div>
                                   <div>
                                       <div className="font-black text-lg flex items-center gap-2">
                                           {p.name}
                                           {p.id === playerId && <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded uppercase tracking-widest">Host</span>}
                                       </div>
                                   </div>
                               </div>
                               <div className="flex gap-3 items-center">
                                   <span className="font-bold text-indigo-400 text-sm">{p.score} pt</span>
                                   {p.id !== playerId && (
                                       <button onClick={() => handleKick(p.id)} className="text-red-400 hover:text-red-600 p-2 bg-red-50 hover:bg-red-100 rounded-full transition-colors">
                                           <UserX size={16} />
                                       </button>
                                   )}
                               </div>
                           </div>
                       ))}
                   </div>
                </div>
            )}
          </div>

          <div className="flex-[1] bg-white rounded-[40px] p-8 text-indigo-900 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden text-center min-w-[300px]">
             <h3 className="text-2xl font-black uppercase mb-2">Gabung Party</h3>
             <p className="text-sm font-bold opacity-60 mb-8">Scan QR atau gunakan link</p>
             
             <div className="bg-white p-4 rounded-3xl shadow-lg border-4 border-indigo-50 mb-6">
                <QRCodeSVG value={`${window.location.origin}/?room=${roomId}`} size={200} />
             </div>
             
             <div className="bg-indigo-50 px-6 py-4 rounded-2xl w-full mb-4">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Kode Room</div>
                <div className="text-4xl font-black font-mono tracking-widest text-indigo-600">{roomId}</div>
             </div>
             
             <div className="text-xs font-bold bg-indigo-100 text-indigo-600 px-4 py-3 rounded-xl w-full truncate border border-indigo-200 cursor-pointer hover:bg-indigo-200 transition-colors" title="Click to copy" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`);
                alert('Link disalin!');
             }}>
                {`${window.location.origin}/?room=${roomId}`}
             </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button 
            onClick={() => socket.emit('start_target_stage', { roomId, playerId })}
            disabled={players.length === 0}
            className="bg-yellow-400 disabled:bg-indigo-800/50 disabled:text-indigo-400 text-indigo-900 px-16 py-6 rounded-full text-3xl font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-transform shadow-xl"
          >
            Mulai Ronde
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

