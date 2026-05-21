import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Room } from '../../server';
import { analyzeImageColors, extractAndAnalyzeTarget } from '../utils/color';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, ArrowLeft, Users, User, Trophy, Scale, CheckCircle2 } from 'lucide-react';
import PaintDecorations from './PaintDecorations';
import { getRandomHTMLColor } from '../utils/htmlColors';

interface Props {
  socket: Socket;
  roomData: Room;
  playerName: string;
  playerId: string;
  onBack: () => void;
}

export default function PlayerView({ socket, roomData, playerName, playerId, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [displayStage, setDisplayStage] = useState(roomData.stage);
  const [showCurtain, setShowCurtain] = useState(false);
  
  // Local spin state for TARGET stage to sync with host
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinHex, setSpinHex] = useState('#FFFFFF');
  const [spinName, setSpinName] = useState('???');

  useEffect(() => {
    if (roomData.stage === 'TARGET') {
      setIsSpinning(true);
      const interval = setInterval(() => {
        const randomColor = getRandomHTMLColor();
        setSpinHex(randomColor.hex);
        setSpinName(randomColor.name);
      }, 80);
      
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setIsSpinning(false);
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else {
      setIsSpinning(false);
    }
  }, [roomData.stage, roomData.round]);
  
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const me = roomData.players[playerId];
  const target = roomData.targetColor;

  useEffect(() => {
    if (roomData.stage === 'REVEAL' && displayStage === 'HUNT') {
      setShowCurtain(true);
      setTimeout(() => {
        setDisplayStage('REVEAL');
        setTimeout(() => setShowCurtain(false), 800);
      }, 1500);
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
      interval = setInterval(updateTimer, 500); // 500ms for more accurate zero-crossing
    }
    return () => clearInterval(interval);
  }, [displayStage, roomData.endTime, roomData.serverTime]);

  useEffect(() => {
    if (displayStage === 'HUNT' && timeLeft === 0 && !hasSubmitted && stream && !isProcessing) {
       captureAndSubmit();
    }
  }, [displayStage, timeLeft, hasSubmitted, stream, isProcessing]);

  useEffect(() => {
    if (roomData.stage === 'HUNT' && !hasSubmitted && !stream) {
      startCamera();
    } else if (roomData.stage !== 'HUNT' && stream) {
      stopCamera();
    }
  }, [roomData.stage, hasSubmitted]);

  // Set hasSubmitted if reconnected after submitting
  useEffect(() => {
     if (me?.lastImage) {
        setHasSubmitted(true);
     }
  }, [me?.lastImage]);

  // Reset submission state when returning to LOBBY or TARGET
  useEffect(() => {
    if (roomData.stage === 'LOBBY' || roomData.stage === 'TARGET') {
      setHasSubmitted(false);
      setCameraError(null);
    }
  }, [roomData.stage]);

  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream, roomData.stage, hasSubmitted]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser Anda tidak mendukung akses kamera.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },   // Membatasi resolusi ideal agar tidak berat di HP
          height: { ideal: 480 }
        } 
      });
      setStream(mediaStream);
    } catch (err: any) {
      console.error("Camera error:", err);
      let msg = "Gagal mengakses kamera.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "Kamera tidak ditemukan.";
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureAndSubmit = () => {
    if (!videoRef.current || !target) return;
    setIsProcessing(true);

    try {
      const analysis = extractAndAnalyzeTarget(videoRef.current, target.hex);
      
      const canvas = document.createElement("canvas");
      // Resized image for server processing and hosting display (128x128 as suggested)
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      
      const videoSize = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
      const startX = (videoRef.current.videoWidth - videoSize) / 2;
      const startY = (videoRef.current.videoHeight - videoSize) / 2;
      
      if (ctx) {
        // Draw the square center crop
        ctx.drawImage(videoRef.current, startX, startY, videoSize, videoSize, 0, 0, 128, 128);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        
        socket.emit('submit_color', { 
          roomId: roomData.id, 
          image: base64Image, 
          score: analysis.similarity,
          capturedColor: analysis.finalDominantColor,
          grade: analysis.grade,
          playerId
        });
        
        setHasSubmitted(true);
        stopCamera();
      }
    } catch (err) {
      console.error("Capture capture error:", err);
    }
    setIsProcessing(false);
  };

  const renderContent = () => {
    if (roomData.stage === 'LOBBY') {
      const isHost = playerId === roomData.hostId;
      const playersArr = Object.values(roomData.players);
      return (
        <div className="flex flex-col items-center justify-start p-6 text-center space-y-6 h-full flex-1 w-full max-w-sm mx-auto overflow-y-auto text-indigo-900 relative">
          <div className="bg-white p-5 px-8 rounded-[32px] shadow-sm border-t-4 border-yellow-400 rotate-[-1deg] mb-4 shrink-0 transition-transform active:scale-95 group relative z-10">
             <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300 mb-1">Room Code</div>
             <div className="text-4xl font-black font-mono tracking-widest text-indigo-950 uppercase">{roomData.id}</div>
          </div>

          <div className="w-full max-w-sm space-y-4">
            {roomData.mode === 'GROUP' && (
                <div className="bg-white/40 backdrop-blur-md p-6 rounded-[40px] border border-white shadow-sm">
                    <h3 className="font-black text-[10px] uppercase tracking-[0.4em] mb-4 text-indigo-400">Pilih Kubu</h3>
                    <div className="grid grid-cols-2 gap-3">
                       <button 
                         onClick={() => socket.emit('switch_team', { roomId: roomData.id, team: 'Red', playerId })}
                         className={`relative overflow-hidden p-4 rounded-[24px] font-black uppercase tracking-tighter transition-all text-sm flex flex-col items-center gap-1 ${me?.team === 'Red' ? 'bg-red-500 text-white shadow-xl scale-105' : 'bg-white text-indigo-400 active:scale-95'}`}
                       >
                          <div className={`w-2 h-2 rounded-full mb-1 ${me?.team === 'Red' ? 'bg-white' : 'bg-red-500'}`} />
                          TIM MERAH
                       </button>
                       <button 
                         onClick={() => socket.emit('switch_team', { roomId: roomData.id, team: 'Blue', playerId })}
                         className={`relative overflow-hidden p-4 rounded-[24px] font-black uppercase tracking-tighter transition-all text-sm flex flex-col items-center gap-1 ${me?.team === 'Blue' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white text-indigo-400 active:scale-95'}`}
                       >
                          <div className={`w-2 h-2 rounded-full mb-1 ${me?.team === 'Blue' ? 'bg-white' : 'bg-blue-600'}`} />
                          TIM BIRU
                       </button>
                    </div>
                </div>
            )}

            {/* Players List */}
            <div className="bg-white/40 backdrop-blur-md p-6 rounded-[40px] border border-white shadow-sm flex flex-col min-h-0 max-h-[300px]">
               <div className="flex justify-between items-end mb-4 px-2">
                 <h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-indigo-400">Pemain Terhubung</h3>
                 <span className="text-[10px] font-black text-indigo-950 px-2 py-1 bg-indigo-50 rounded-lg">{playersArr.length}</span>
               </div>
               <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {playersArr.map(p => (
                    <motion.div 
                      layout
                      key={p.id} 
                      className="bg-white/80 px-5 py-3 rounded-[20px] flex items-center justify-between text-indigo-950 text-sm shadow-sm border border-indigo-50/50"
                    >
                       <div className="font-black flex items-center gap-3 truncate font-display italic">
                          <div className={`w-2 h-2 rounded-full ${p.team === 'Red' ? 'bg-red-500' : p.team === 'Blue' ? 'bg-blue-600' : 'bg-gray-300'}`} />
                          <span className="truncate">{p.name} {p.id === playerId && <span className="text-[8px] opacity-40 ml-1">#YOU</span>}</span>
                       </div>
                       {p.id === roomData.hostId && <span className="text-[8px] bg-yellow-400 text-indigo-900 font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-sm">HOST</span>}
                    </motion.div>
                  ))}
               </div>
            </div>

            {isHost && (
              <div className="pt-4">
                 <button 
                  onClick={() => socket.emit('start_target_stage', { roomId: roomData.id, playerId })}
                  disabled={playersArr.length === 0}
                  className="w-full bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 text-white py-6 rounded-[32px] font-black uppercase tracking-widest transition-all shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] hover:translate-y-[-2px] active:scale-95 flex items-center justify-center gap-3"
                >
                  <Camera size={20} />
                  MULAI GAME
                </button>
                <p className="text-[10px] font-bold text-indigo-300 mt-4 uppercase tracking-[0.2em]">Game Ini Membutuhkan Akses Kamera</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (roomData.stage === 'TARGET') {
      return (
        <div className="flex flex-col items-center justify-center p-4 text-center h-full flex-1 w-full max-w-sm mx-auto text-indigo-950 relative">
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="mb-4 relative z-10"
          >
            <div className="bg-white p-2 px-6 rounded-2xl shadow-sm border-t-4 border-yellow-400 rotate-[-1deg] inline-block mb-1">
              <span className="text-indigo-950 font-black text-lg tracking-tighter uppercase font-display">
                {isSpinning ? 'MENGACAK...' : 'BERSIAPLAH!'}
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300 pt-1">
              {isSpinning ? 'Tunggu Sebentar' : 'Hafalkan Warnanya!'}
            </p>
          </motion.div>

          <div className="relative mb-4">
             <div className="absolute inset-0 bg-black/10 rounded-[32px] blur-2xl translate-y-4 scale-90" />
             <motion.div 
                animate={isSpinning ? { rotateY: [0, 180], scale: [1, 0.95, 1] } : { scale: 1, opacity: 1 }}
                transition={isSpinning ? { duration: 0.2, repeat: Infinity } : { type: "spring", damping: 12 }}
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-[32px] sm:rounded-[40px] border-[6px] sm:border-[8px] border-white relative z-10 shadow-2xl mx-auto"
                style={{ backgroundColor: isSpinning ? spinHex : target?.hex }}
             >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-[26px] sm:rounded-[32px]" />
             </motion.div>
          </div>

          <motion.h1 
            key={isSpinning ? 'spinning' : 'target'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xl sm:text-2xl font-black uppercase tracking-tighter italic font-display mb-4"
          >
            {isSpinning ? spinName : target?.name}
          </motion.h1>

          <div className="w-full bg-white/40 backdrop-blur-md p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-white shadow-sm mt-auto max-w-[280px] mx-auto">
             <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-1 sm:mb-2 text-indigo-400">Waktu Persiapan</div>
             <div className={`text-3xl sm:text-4xl font-black font-mono tracking-tighter ${timeLeft <= 3 && !isSpinning ? 'text-red-500 animate-pulse' : 'text-indigo-950'}`}>
                00:{timeLeft.toString().padStart(2, '0')}
             </div>
          </div>
        </div>
      );
    }

    if (roomData.stage === 'HUNT') {
      if (hasSubmitted) {
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center h-full flex-1 w-full max-w-sm mx-auto text-indigo-950 relative">
            <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white rounded-[50px] p-10 w-full shadow-2xl border border-indigo-50 mb-10 flex flex-col items-center relative overflow-hidden z-10"
            >
              <CheckCircle2 size={100} className="text-green-500 mb-8 relative z-10" />
              <h2 className="text-4xl font-black uppercase tracking-tighter font-display italic mb-2 relative z-10">Terkirim!</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest relative z-10">Silahkan Tunggu Host...</p>
            </motion.div>

            <div className="bg-indigo-600 p-8 rounded-[40px] w-full shadow-xl flex flex-col items-center border-t-8 border-indigo-400">
               <div className="text-[10px] font-bold uppercase tracking-[0.4em] mb-3 text-indigo-200">Sisa Waktu Perburuan</div>
               <div className={`text-6xl font-black font-mono tracking-tighter text-white ${timeLeft <= 5 ? 'animate-bounce text-red-300' : ''}`}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col h-screen w-full relative bg-gray-900 overflow-hidden">
          {/* Target Bar (Memorize Mode) */}
          <div className="absolute top-0 inset-x-0 h-14 z-20 flex justify-center items-center px-6 shadow-xl bg-indigo-950 border-b border-indigo-900">
             <div className="absolute bottom-0 left-0 h-1 bg-white/20" style={{ width: `${(timeLeft / 20) * 100}%` }} />
             <span className="text-white/60 font-black uppercase italic font-display tracking-[0.2em] text-xs">
                TEMUKAN WARNANYA!
             </span>
          </div>
          
          <div className="flex-1 relative flex flex-col items-center justify-center p-4">
            {cameraError ? (
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-[40px] border border-white/20 text-center max-w-xs">
                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Camera size={32} />
                </div>
                <h3 className="text-white font-black uppercase tracking-widest mb-4">Masalah Kamera</h3>
                <p className="text-white/60 text-sm mb-8 leading-relaxed font-bold">
                  {cameraError}
                </p>
                <button 
                  onClick={startCamera}
                  className="w-full bg-white text-indigo-900 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95"
                >
                  Coba Lagi
                </button>
                <p className="text-white/30 text-[10px] mt-6 font-bold uppercase tracking-widest">Atau pastikan situs menggunakan HTTPS</p>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Viewfinder overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-[40px] border-black/40">
                  <div className="w-full aspect-square max-w-[280px] border-4 border-dashed border-white/60 rounded-[40px] relative">
                    {/* Corner decorations */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-8 border-l-8 border-yellow-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-8 border-r-8 border-yellow-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-8 border-l-8 border-yellow-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-8 border-r-8 border-yellow-400 rounded-br-xl" />
                  </div>
                </div>

                {/* Floating Timer */}
                <div className={`absolute top-20 right-6 backdrop-blur-md px-5 py-2 rounded-2xl font-mono font-black text-2xl border shadow-xl z-20 transition-colors ${timeLeft <= 5 ? 'bg-red-500/80 border-red-400 text-white animate-pulse' : 'bg-black/40 border-white/20 text-white'}`}>
                  {timeLeft}S
                </div>
              </>
            )}
          </div>
          
          {!cameraError && (
            <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-2xl py-10 pb-[env(safe-area-inset-bottom,40px)] px-6 flex justify-center items-center z-30 border-t border-white/10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-indigo-600 text-[10px] font-black text-white px-4 py-1.5 rounded-full shadow-lg border border-indigo-400 z-40 animate-bounce">
                AMBIL GAMBAR SEKARANG
              </div>
              <button 
                onClick={captureAndSubmit}
                disabled={isProcessing || !stream}
                className="group w-24 h-24 bg-white rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 relative p-1 shadow-[0_0_50px_rgba(255,255,255,0.3)] mb-4"
              >
                <div className="w-full h-full bg-white border-[8px] border-indigo-950 rounded-full flex items-center justify-center shadow-inner">
                  <Camera size={32} className="text-indigo-950 group-active:scale-110 transition-transform" />
                </div>
              </button>
            </div>
          )}
        </div>
      );
    }

    if (roomData.stage === 'FINAL_LEADERBOARD') {
      const finalSortedPlayers = Object.values(roomData.players).sort((a, b) => b.score - a.score);
      const isHost = playerId === roomData.hostId;
      const myRank = finalSortedPlayers.findIndex(p => p.id === playerId) + 1;
      
      return (
        <div className="flex flex-col items-center py-8 p-6 h-full flex-1 w-full max-w-md mx-auto overflow-y-auto text-indigo-950 relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[50px] p-8 md:p-10 w-full shadow-2xl border border-indigo-50 mb-8 flex flex-col relative overflow-hidden shrink-0 z-10"
          >
            <div className="absolute -top-4 -right-4 p-8 text-indigo-50 font-black text-8xl select-none uppercase tracking-tighter italic font-display leading-[0.8] mix-blend-multiply opacity-30 z-0">TOP</div>
             <div className="text-center relative z-10">
                <Trophy size={60} className="text-yellow-400 mx-auto mb-4" />
                <h1 className="text-3xl font-black uppercase tracking-tighter text-indigo-950 font-display italic mb-2">Permainan berakhir!</h1>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">Peringkat Anda: #{myRank}</div>
                
                <div className="bg-indigo-600 text-white p-6 rounded-[32px] shadow-lg mb-8">
                   <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Skor Akhir</div>
                   <div className="text-5xl font-black font-display italic tracking-tight">{me?.score}</div>
                </div>
             </div>

             <div className="space-y-3 relative z-10">
                {finalSortedPlayers.slice(0, 5).map((p, index) => (
                    <div key={p.id} className={`flex items-center justify-between p-4 rounded-[20px] transition-all ${p.id === playerId ? 'bg-indigo-50 border-2 border-indigo-500 scale-[1.02]' : 'bg-gray-50 border border-gray-100'} w-full`}>
                       <div className="flex items-center gap-3 truncate">
                           <div className={`text-xl font-black ${index === 0 ? 'text-yellow-500' : 'text-indigo-200'}`}>#{index + 1}</div>
                           <div className="truncate">
                               <div className="text-sm font-black truncate">{p.name} {p.id === playerId && <span className="text-[10px] opacity-40 ml-1">#YOU</span>}</div>
                           </div>
                       </div>
                       <div className="text-xl font-black text-indigo-600 shrink-0 ml-2">{p.score}</div>
                    </div>
                ))}
             </div>
          </motion.div>
          
          {isHost && (
             <button 
               onClick={() => socket.emit('new_game', { roomId: roomData.id, playerId })}
               className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[32px] font-black uppercase tracking-widest transition-all shadow-xl shrink-0 flex items-center justify-center gap-2"
             >
               <RefreshCw size={20} />
               MAIN LAGI
             </button>
          )}
        </div>
      );
    }

    if (roomData.stage === 'REVEAL') {
      const players = Object.values(roomData.players);
      const submitted = players.filter(p => p.lastImage !== null).sort((a, b) => (b.lastScore || 0) - (a.lastScore || 0));
      const notSubmitted = players.filter(p => p.lastImage === null).sort((a, b) => a.name.localeCompare(b.name));
      const isHost = playerId === roomData.hostId;
      const myRecentScore = me?.lastScore || 0;

      return (
        <div className="flex flex-col items-center py-4 px-4 h-full flex-1 w-full max-w-md mx-auto overflow-y-auto text-indigo-950 relative">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-[24px] p-3 w-full max-w-[280px] sm:max-w-sm shadow-2xl border border-indigo-50 mb-3 flex flex-col items-center relative shrink-0 z-10"
          >
            <div className="absolute -top-3 -left-3 p-3 text-indigo-50 font-black text-4xl sm:text-5xl select-none uppercase tracking-tighter italic font-display leading-[0.8] mix-blend-multiply opacity-30 z-0">{me?.lastGrade || 'SCORE'}</div>
            <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-2 z-10">{me?.lastGrade ? `KUALITAS: ${me.lastGrade}` : 'Skor Ronde Ini'}</div>
            
            <div className="relative mb-2 w-full flex justify-center">
              <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 bg-indigo-50 rounded-full border-[4px] sm:border-[6px] border-white shadow-xl flex items-center justify-center">
                 <div className="text-2xl sm:text-3xl font-black tabular-nums text-indigo-950 font-display italic leading-none">{myRecentScore}</div>
              </div>
              {me?.lastImage && (
                <motion.div 
                  initial={{ scale: 0, rotate: 0 }}
                  animate={{ scale: 1, rotate: 12 }}
                  className="absolute bottom-0 right-4 sm:right-6 polaroid-frame w-12 h-14 sm:w-14 sm:h-16 p-1 pb-2 sm:pb-3 shadow-2xl z-20"
                >
                   <img src={me?.lastImage} className="w-full h-full object-cover rounded-sm" />
                </motion.div>
              )}
            </div>
            
            <div className="bg-indigo-600 text-white px-4 py-1 rounded-full mt-1 z-10 flex items-center">
               <span className="text-[8px] font-black uppercase tracking-widest opacity-80 mr-2">Total</span>
               <span className="font-black text-sm sm:text-base font-display leading-none">{me?.score} PTS</span>
            </div>
          </motion.div>

          <div className="w-full max-w-sm space-y-3 mb-3 flex-1 overflow-y-auto custom-scrollbar px-1 min-h-[100px]">
             <AnimatePresence>
              {submitted.length > 0 && (
                <div className="space-y-2">
                  {submitted.map((p, index) => (
                    <motion.div 
                      layout
                      key={p.id} 
                      className={`bg-white/90 p-3 rounded-[20px] flex items-center justify-between text-indigo-950 shadow-sm border transition-all ${p.id === playerId ? 'border-indigo-500 border-2 scale-[1.02]' : 'border-white/50'}`}
                    >
                      <div className="flex items-center gap-3 truncate">
                          <div className={`font-black w-6 text-center text-lg font-display italic ${index === 0 ? 'text-yellow-500' : 'text-indigo-100'}`}>#{index + 1}</div>
                          <div className="truncate text-left">
                              <div className="text-sm font-black truncate leading-tight font-display uppercase tracking-tight italic">{p.name}</div>
                              {p.team && <div className={`text-[9px] font-bold uppercase tracking-widest opacity-60 ${p.team === 'Red' ? 'text-red-500' : 'text-blue-600'}`}>{p.team} Team</div>}
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                         {p.lastGrade && <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${p.lastGrade === 'Perfect' ? 'bg-yellow-400 text-indigo-900' : p.lastGrade === 'Great' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{p.lastGrade}</span>}
                         <span className="font-black text-indigo-600 text-xl font-mono tracking-tighter">{p.lastScore}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {notSubmitted.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-4 py-1">
                    <div className="h-px bg-indigo-100 flex-1" />
                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-indigo-300">Tidak Mengirim Foto</span>
                    <div className="h-px bg-indigo-100 flex-1" />
                  </div>
                  {notSubmitted.map((p) => (
                    <motion.div 
                      layout
                      key={p.id} 
                      className={`bg-white/40 p-3 rounded-[20px] flex items-center justify-between text-indigo-950/40 border border-white/20 transition-all ${p.id === playerId ? 'border-indigo-300/30' : ''}`}
                    >
                      <div className="flex items-center gap-3 truncate">
                          <div className="w-6" />
                          <div className="truncate text-left">
                              <div className="text-xs font-black truncate leading-tight font-display uppercase tracking-tight italic">{p.name}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-50">
                         <Camera size={14} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
             </AnimatePresence>
          </div>

          {isHost && (
             <button 
               onClick={() => socket.emit('next_round', { roomId: roomData.id, playerId })}
               className="w-full max-w-sm bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-[24px] font-black uppercase tracking-widest transition-all shadow-xl mt-auto shrink-0 mb-4"
             >
               {roomData.round >= roomData.maxRounds ? 'Lihat Klasemen' : 'Lanjut Ronde'}
             </button>
          )}
        </div>
      );
    }
  };

  const getThemeColor = () => {
     if (roomData.mode === 'INDIVIDUAL') return 'bg-transparent';
     return me?.team === 'Red' ? 'bg-red-50/50' : me?.team === 'Blue' ? 'bg-blue-50/50' : 'bg-transparent';
  };

  const themeColorClass = getThemeColor();

  return (
    <div className={`h-[100dvh] text-indigo-950 font-sans flex flex-col ${roomData.stage === 'HUNT' && !hasSubmitted ? 'bg-black' : themeColorClass} transition-colors duration-500 overflow-hidden relative`}>
      {(roomData.stage !== 'HUNT' || hasSubmitted) && <PaintDecorations team={me?.team} />}
      {(roomData.stage !== 'HUNT' || hasSubmitted) && (
        <div className="bg-white/80 backdrop-blur-md p-4 flex justify-between items-center z-20 shadow-sm shrink-0 border-b border-gray-100">
          <button onClick={onBack} className="bg-gray-100 hover:bg-gray-200 p-3 rounded-full transition-colors active:scale-95 text-indigo-600 shadow-sm">
             <ArrowLeft size={18} />
          </button>
          
          <div className="flex flex-col items-center">
            <div className="font-black text-xs uppercase tracking-[0.2em] text-indigo-300 leading-none mb-1">Pemain</div>
            <div className="font-black text-sm uppercase tracking-tight truncate max-w-[120px] text-indigo-950 font-display italic" title={playerName}>{playerName}</div>
          </div>

          <div className="flex gap-2">
            {roomData.mode === 'GROUP' && me?.team && (
               <div className={`text-[10px] uppercase tracking-widest font-black text-white px-3 py-2 rounded-xl shadow-md ${me?.team === 'Red' ? 'bg-red-500 border-red-400' : 'bg-blue-600 border-blue-400'}`}>
                 {me?.team}
               </div>
            )}
            {roomData.mode === 'INDIVIDUAL' && (
               <div className="text-[10px] uppercase tracking-widest font-black text-indigo-900 bg-yellow-400 px-3 py-2 rounded-xl shadow-sm border-t-2 border-yellow-200">
                 Solo
               </div>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center overflow-hidden bg-transparent w-full">
        {renderContent()}
      </div>
    </div>
  );
}
