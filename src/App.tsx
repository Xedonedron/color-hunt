import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import HostView from './components/HostView';
import PlayerView from './components/PlayerView';
import LandingPage from './components/LandingPage';
import MainMenu from './components/MainMenu';
import AnimatedBackground from './components/AnimatedBackground';
import { Room } from '../server';

const socket: Socket = io();

export default function App() {
  const [role, setRole] = useState<'NONE' | 'LOBBY' | 'HOST' | 'PLAYER'>('NONE');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [playerName, setPlayerName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [initialRoomCode, setInitialRoomCode] = useState('');

  const roomIdRef = useRef<string | null>(null);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const [playerId] = useState(() => {
    let pid = localStorage.getItem('playerId');
    if (!pid) {
      pid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('playerId', pid);
    }
    return pid;
  });

  useEffect(() => {
    const handleConnect = () => {
      socket.emit('identify', { playerId });
    };
    socket.on('connect', handleConnect);
    if (socket.connected) {
      handleConnect();
    } else {
      socket.emit('identify', { playerId });
    }

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialRoomCode(roomParam.toUpperCase());
    }

    // Try to restore session if localStorage has data
    const savedRoom = localStorage.getItem('savedRoom');
    const savedRole = localStorage.getItem('savedRole');
    const savedName = localStorage.getItem('savedName');
    
    if (savedRoom && savedRole && savedName) {
      // Don't auto-join if they have a ?room= URL parameter, prioritize URL intent
      if (!roomParam) {
        setPlayerName(savedName);
        socket.emit('rejoin_room', { roomId: savedRoom, playerId }, (res: any) => {
          if (res.success) {
            setRoomId(savedRoom);
            setRoomData(res.room);
            setRole(savedRole as any);
          } else {
             // Cleanup if room doesn't exist anymore
             localStorage.removeItem('savedRoom');
             localStorage.removeItem('savedRole');
          }
        });
      }
    }

    socket.on('room_update', (data) => {
      if (roomIdRef.current && roomIdRef.current !== data.id) return;
      setRoomData(data);
    });

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [playerId]);

  // Handle local state cleanup on kick/close
  const clearSession = () => {
      if (roomIdRef.current) {
        socket.emit('leave_room', { roomId: roomIdRef.current, playerId });
      }
      localStorage.removeItem('savedRoom');
      localStorage.removeItem('savedRole');
      setRole('LOBBY');
      setRoomId(null);
      setRoomData(null);
  };

  useEffect(() => {
    socket.on('room_closed', () => {
      setErrorMsg('Room telah ditutup oleh host.');
      setTimeout(() => setErrorMsg(''), 5000);
      clearSession();
    });

    socket.on('error', ({ message }) => {
       setErrorMsg(message);
       setTimeout(() => setErrorMsg(''), 5000);
    });

    socket.on('kicked', () => {
      setErrorMsg('Anda telah dikeluarkan dari room.');
      setTimeout(() => setErrorMsg(''), 5000);
      clearSession();
    });

    return () => {
      socket.off('room_update');
      socket.off('room_closed');
      socket.off('error');
      socket.off('kicked');
    };
  }, []);

  const handleStart = (name: string) => {
    if (!name.trim()) {
      setErrorMsg('Silakan isi nama Anda terlebih dahulu!');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    setPlayerName(name);
    localStorage.setItem('savedName', name);

    if (initialRoomCode) {
       socket.emit('join_room', { roomId: initialRoomCode, name, team: null, playerId }, (response: any) => {
         if (response.error) {
           setErrorMsg(response.error);
           setTimeout(() => setErrorMsg(''), 5000);
           setRole('LOBBY');
         } else {
           setRoomId(initialRoomCode);
           setRoomData(response.room);
           setRole('PLAYER');
           localStorage.setItem('savedRoom', initialRoomCode);
           localStorage.setItem('savedRole', 'PLAYER');
         }
       });
       window.history.replaceState({}, '', '/');
       setInitialRoomCode('');
    } else {
       setRole('LOBBY');
    }
  };

  const handleBackToLobby = () => {
     clearSession();
  };

  const handlePlayNow = () => {
    socket.emit('play_now', { name: playerName, playerId }, (response: any) => {
      if (response.success) {
        setRoomId(response.room.id);
        setRoomData(response.room);
        setRole('PLAYER');
        localStorage.setItem('savedRoom', response.room.id);
        localStorage.setItem('savedRole', 'PLAYER');
      } else {
        alert(response.error || 'Gagal mencari room');
      }
    });
  };

  const handleCreateParty = (mode: 'INDIVIDUAL' | 'GROUP', isSpectator: boolean) => {
    socket.emit('create_room', { mode, playerId }, ({ roomId }: { roomId: string }) => {
      setRoomId(roomId);
      localStorage.setItem('savedRoom', roomId);
      
      if (!isSpectator) {
         // Join as active player
         socket.emit('join_room', { roomId, name: playerName, team: null, playerId }, () => {
            setRole('PLAYER');
            localStorage.setItem('savedRole', 'PLAYER');
         });
      } else {
         // Join just as spectator host
         setRole('HOST');
         localStorage.setItem('savedRole', 'HOST');
      }
    });
  };

  const handleJoinParty = (id: string) => {
    socket.emit('join_room', { roomId: id.toUpperCase(), name: playerName, team: null, playerId }, (response: any) => {
      if (response.error) {
        setErrorMsg(response.error);
        setTimeout(() => setErrorMsg(''), 5000);
      } else {
        setRoomId(id.toUpperCase());
        setRoomData(response.room);
        setRole('PLAYER');
        localStorage.setItem('savedRoom', id.toUpperCase());
        localStorage.setItem('savedRole', 'PLAYER');
      }
    });
  };

  // Error Toast
  const renderError = () => {
     if (!errorMsg) return null;
     return (
       <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white font-bold px-6 py-3 rounded-full z-50 shadow-xl">
          {errorMsg}
       </div>
     );
  }

  if (role === 'HOST' && roomId && roomData) {
    return (
      <>
        <AnimatedBackground />
        {renderError()}
        <HostView socket={socket} roomData={roomData} roomId={roomId} playerName={playerName} playerId={playerId} onBack={handleBackToLobby} />
      </>
    );
  }

  if (role === 'PLAYER' && roomData) {
    return (
      <>
        <AnimatedBackground />
        {renderError()}
        <PlayerView socket={socket} roomData={roomData} playerName={playerName} playerId={playerId} onBack={handleBackToLobby} />
      </>
    );
  }

  if (role === 'LOBBY') {
    return (
       <>
         <AnimatedBackground />
         {renderError()}
         <MainMenu 
           playerName={playerName} 
           socket={socket}
           onCreateParty={handleCreateParty} 
           onJoinParty={handleJoinParty} 
           onBack={() => setRole('NONE')} 
         />
       </>
    );
  }

  return (
    <>
      <AnimatedBackground />
      {renderError()}
      <LandingPage onStart={handleStart} />
    </>
  );
}
