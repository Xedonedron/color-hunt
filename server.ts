import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { Jimp } from 'jimp';
import { analyzeImageColors } from './src/utils/color.js';

import { getRandomHTMLColor } from './src/utils/htmlColors.js';

// Generate a random HTML color
function generateRandomColor() {
  return getRandomHTMLColor();
}

export interface Player {
  id: string; // Persistent Player ID
  socketId: string; // Current socket ID
  name: string;
  team: 'Red' | 'Blue' | null;
  score: number;
  lastScore: number;
  lastGrade?: string;
  lastImage: string | null;
  connected: boolean;
  lastSeen: number | null;
}

export interface Room {
  id: string;
  hostId: string; // Persistent Player ID of the host
  hostSocketId: string;
  mode: 'INDIVIDUAL' | 'GROUP';
  players: Record<string, Player>;
  stage: 'LOBBY' | 'TARGET' | 'HUNT' | 'REVEAL' | 'FINAL_LEADERBOARD';
  targetColor: { name: string; hex: string } | null;
  endTime: number | null;
  serverTime?: number;
  maxPlayers: number;
  round: number;
  maxRounds: number;
}

const rooms: Record<string, Room> = {};
const MAX_PLAYERS = 10;

// Helper to assign a balanced team
function getBalancedTeam(room: Room): 'Red' | 'Blue' {
  const playersArr = Object.values(room.players);
  const redCount = playersArr.filter(p => p.team === 'Red').length;
  const blueCount = playersArr.filter(p => p.team === 'Blue').length;
  return redCount <= blueCount ? 'Red' : 'Blue';
}

function emitRoomUpdate(io: any, roomId: string, room: Room) {
  room.serverTime = Date.now();
  io.to(roomId).emit('room_update', room);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 5 * 1024 * 1024 // 5MB limit for Base64 images
  });

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Socket.io logic
  const DISCONNECT_GRACE_PERIOD_MS = 60000;

  io.on('connection', (socket) => {
    
    // Identity mapping
    socket.on('identify', ({ playerId }) => {
      // Find if player was in any room and update their socketId
      for (const roomId in rooms) {
        const room = rooms[roomId];
        
        if (room.hostId === playerId) {
          room.hostSocketId = socket.id;
        }

        if (room.players[playerId]) {
          room.players[playerId].connected = true;
          room.players[playerId].socketId = socket.id;
          room.players[playerId].lastSeen = Date.now();
          socket.join(roomId);
          emitRoomUpdate(io, roomId, room);
        }
      }
    });

    socket.on('rejoin_room', ({ roomId, playerId }, callback) => {
      const room = rooms[roomId];
      if (!room) return callback({ error: 'Room not found' });
      
      let success = false;
      if (room.hostId === playerId) {
          room.hostSocketId = socket.id;
          socket.join(roomId);
          success = true;
      }
      
      if (room.players[playerId]) {
          room.players[playerId].connected = true;
          room.players[playerId].socketId = socket.id;
          room.players[playerId].lastSeen = Date.now();
          socket.join(roomId);
          success = true;
      }
      
      if (success) {
          emitRoomUpdate(io, roomId, room);
          callback({ success: true, room });
      } else {
          callback({ error: 'Player note found in room' });
      }
    });

    // Create a party
    socket.on('create_room', ({ mode, playerId }, callback) => {
      // Create a 6 character code
      let roomId = '';
      do {
        roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      } while (rooms[roomId]);
      
      rooms[roomId] = {
        id: roomId,
        hostId: playerId,
        hostSocketId: socket.id,
        mode,
        players: {},
        stage: 'LOBBY',
        targetColor: null,
        endTime: null,
        maxPlayers: MAX_PLAYERS,
        round: 0,
        maxRounds: 5
      };
      
      socket.join(roomId);
      callback({ roomId });
      emitRoomUpdate(io, roomId, rooms[roomId]);
    });

    // Join a specific party
    socket.on('join_room', ({ roomId, name, team, playerId }, callback) => {
      const room = rooms[roomId];
      if (!room) {
        return callback({ error: 'Room tidak ditemukan' });
      }
      if (room.stage !== 'LOBBY') {
        return callback({ error: 'Permainan sudah dimulai' });
      }
      if (Object.keys(room.players).length >= room.maxPlayers && !room.players[playerId]) {
        return callback({ error: 'Room sudah penuh' });
      }

      let assignedTeam = team;
      if (room.mode === 'INDIVIDUAL') {
        assignedTeam = null;
      } else if (!assignedTeam) {
        assignedTeam = getBalancedTeam(room);
      }

      room.players[playerId] = {
        id: playerId,
        socketId: socket.id,
        name,
        team: assignedTeam,
        score: room.players[playerId]?.score || 0,
        lastScore: room.players[playerId]?.lastScore || 0,
        lastImage: room.players[playerId]?.lastImage || null,
        connected: true,
        lastSeen: Date.now()
      };
      
      socket.join(roomId);
      io.to(roomId).emit('room_update', room);
      callback({ success: true, room });
    });

    // Play Now - Join existing random room or create one
    socket.on('play_now', ({ name, playerId }, callback) => {
      let availableRoomId = Object.keys(rooms).find(id => {
        const r = rooms[id];
        return r.stage === 'LOBBY' && Object.keys(r.players).length > 0 && Object.keys(r.players).length < r.maxPlayers;
      });

      let roomId;
      let assignedTeam = null;

      if (availableRoomId) {
        roomId = availableRoomId;
        const room = rooms[roomId];
        if (room.mode === 'GROUP') {
           assignedTeam = getBalancedTeam(room);
        }
      } else {
        // Create new room if none available (defaults to GROUP mode)
        roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomId] = {
          id: roomId,
          hostId: playerId, // first joiner becomes host implicitly
          hostSocketId: socket.id,
          mode: 'GROUP', 
          players: {},
          stage: 'LOBBY',
          targetColor: null,
          endTime: null,
          maxPlayers: MAX_PLAYERS,
          round: 0,
          maxRounds: 5
        };
        socket.join(roomId);
        assignedTeam = 'Red';
      }

      const room = rooms[roomId];
      room.players[playerId] = {
        id: playerId,
        socketId: socket.id,
        name,
        team: assignedTeam,
        score: 0,
        lastScore: 0,
        lastImage: null,
        connected: true,
        lastSeen: Date.now()
      };

      socket.join(roomId);
      emitRoomUpdate(io, roomId, room);
      callback({ success: true, room });
    });

    socket.on('switch_team', ({ roomId, team, playerId }) => {
      const room = rooms[roomId];
      if (room && room.players[playerId] && room.stage === 'LOBBY' && room.mode === 'GROUP') {
        room.players[playerId].team = team;
        emitRoomUpdate(io, roomId, room);
      }
    });

    socket.on('force_balance', ({ roomId, playerId }) => {
       const room = rooms[roomId];
       if (room && room.hostId === playerId && room.mode === 'GROUP' && room.stage === 'LOBBY') {
           const playersArr = Object.values(room.players);
           const half = Math.ceil(playersArr.length / 2);
           let redCount = 0;
           let blueCount = 0;
           for (const p of playersArr) {
               if (redCount < half) {
                   p.team = 'Red';
                   redCount++;
               } else {
                   p.team = 'Blue';
                   blueCount++;
               }
           }
           emitRoomUpdate(io, roomId, room);
       }
    });

    socket.on('kick_player', ({ roomId, playerId, targetPlayerId }) => {
      const room = rooms[roomId];
      if (room && room.hostId === playerId && room.players[targetPlayerId]) {
         const targetSocketId = room.players[targetPlayerId].socketId;
         delete room.players[targetPlayerId];
         emitRoomUpdate(io, roomId, room);
         io.to(targetSocketId).emit('kicked');
      }
    });

    socket.on('start_target_stage', ({ roomId, playerId }) => {
      const room = rooms[roomId];
      if (room && room.hostId === playerId && (room.stage === 'LOBBY')) {
        // Group balance validation
        if (room.mode === 'GROUP') {
           const redCount = Object.values(room.players).filter(p => p.team === 'Red').length;
           const blueCount = Object.values(room.players).filter(p => p.team === 'Blue').length;
           if (Math.abs(redCount - blueCount) > 1) {
              return io.to(socket.id).emit('error', { message: 'Tim tidak seimbang! Selisih maksimal 1 pemain' });
           }
        }

        room.round += 1;
        if (room.round > room.maxRounds) {
           room.stage = 'FINAL_LEADERBOARD';
           emitRoomUpdate(io, roomId, room);
           return;
        }

        room.stage = 'TARGET';
        room.targetColor = generateRandomColor();
        room.endTime = Date.now() + 10000; // 10 seconds for target stage (5s spin + 5s wait)
        Object.values(room.players).forEach(p => {
          p.lastImage = null;
          p.lastScore = 0;
        });
        emitRoomUpdate(io, roomId, room);
        
        setTimeout(() => {
          if (rooms[roomId] && rooms[roomId].stage === 'TARGET') {
            rooms[roomId].stage = 'HUNT';
            rooms[roomId].endTime = Date.now() + 20000; // 20s
            emitRoomUpdate(io, roomId, rooms[roomId]);
            
            setTimeout(() => {
              if (rooms[roomId] && rooms[roomId].stage === 'HUNT') {
                rooms[roomId].stage = 'REVEAL';
                rooms[roomId].endTime = null;
                emitRoomUpdate(io, roomId, rooms[roomId]);
              }
            }, 20000);
          }
        }, 10000);
      }
    });

    socket.on('submit_color', async ({ roomId, image, score: clientScore, playerId }) => {
      const room = rooms[roomId];
      if (room && (room.stage === 'HUNT' || room.stage === 'REVEAL') && room.players[playerId] && room.targetColor) {
        // Prevent multiple submissions in one round
        if (room.players[playerId].lastImage) return;

        let finalScore = clientScore;
        let finalGrade = "Miss";

        try {
          // Server-side verification for anti-cheat
          // 1. Remove base64 prefix
          const base64Data = image.replace(/^data:image\/png;base64,/, "").replace(/^data:image\/jpeg;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          // 2. Load with Jimp
          const jimpImg = await Jimp.read(buffer);
          
          // 3. Resize to standard analysis size (matching client-side)
          jimpImg.resize({ w: 128, h: 128 });
          
          // 4. Extract pixel data
          const pixelBuffer = jimpImg.bitmap.data;
          
          // 5. Run analysis using standard utility
          const result = analyzeImageColors(
            pixelBuffer, 
            jimpImg.bitmap.width, 
            jimpImg.bitmap.height, 
            room.targetColor.hex
          );
          
          finalScore = result.similarity;
          finalGrade = result.grade;
          
          console.log(`[Score Verify] Player ${room.players[playerId].name}: Client=${clientScore}, Server=${finalScore}, Grade=${finalGrade}`);
        } catch (err) {
          console.error("Server-side scoring failed, falling back to client score:", err);
        }

        room.players[playerId].lastImage = image;
        room.players[playerId].lastScore = finalScore;
        room.players[playerId].lastGrade = finalGrade;
        room.players[playerId].score += finalScore;
        
        // Notify host
        if (room.hostSocketId) {
            io.to(room.hostSocketId).emit('player_submitted', { playerId });
        }
        
        // If they submitted late during REVEAL stage, we must update the room to show their delayed submission
        if (room.stage === 'REVEAL') {
          io.to(roomId).emit('room_updated', room);
        }
      }
    });

    socket.on('next_round', ({ roomId, playerId }) => {
      const room = rooms[roomId];
      if (room && (room.hostId === playerId || room.hostId === socket.id)) {
        room.round += 1;
        if (room.round > room.maxRounds) {
           room.stage = 'FINAL_LEADERBOARD';
           emitRoomUpdate(io, roomId, room);
           return;
        }

        room.stage = 'TARGET';
        room.targetColor = generateRandomColor();
        room.endTime = Date.now() + 10000;
        Object.values(room.players).forEach(p => {
          p.lastImage = null;
          p.lastScore = 0;
        });
        emitRoomUpdate(io, roomId, room);
        
        setTimeout(() => {
          if (rooms[roomId] && rooms[roomId].stage === 'TARGET') {
            rooms[roomId].stage = 'HUNT';
            rooms[roomId].endTime = Date.now() + 20000; // 20s
            emitRoomUpdate(io, roomId, rooms[roomId]);
            
            setTimeout(() => {
              if (rooms[roomId] && rooms[roomId].stage === 'HUNT') {
                rooms[roomId].stage = 'REVEAL';
                rooms[roomId].endTime = null;
                emitRoomUpdate(io, roomId, rooms[roomId]);
              }
            }, 20000);
          }
        }, 10000);
      }
    });

    socket.on('new_game', ({ roomId, playerId }) => {
      const room = rooms[roomId];
      if (room && (room.hostId === playerId || room.hostId === socket.id)) {
        room.round = 0;
        room.stage = 'LOBBY';
        room.targetColor = null;
        room.endTime = null;
        Object.values(room.players).forEach(p => {
          p.score = 0;
          p.lastImage = null;
          p.lastScore = 0;
        });
        emitRoomUpdate(io, roomId, room);
      }
    });

    socket.on('leave_room', ({ roomId, playerId }) => {
      const room = rooms[roomId];
      if (room) {
        socket.leave(roomId);
        if (room.players[playerId]) {
          delete room.players[playerId];
        }
        
        let shouldUpdate = true;

        if (room.hostId === playerId) {
          const remainingPlayers = Object.keys(room.players);
          if (remainingPlayers.length > 0) {
            room.hostId = remainingPlayers[0];
          } else {
            delete rooms[roomId];
            shouldUpdate = false;
          }
        }

        if (shouldUpdate) {
            emitRoomUpdate(io, roomId, room);
        }
      }
    });

    socket.on('disconnect', () => {
      for (const roomId in rooms) {
        const room = rooms[roomId];
        
        let shouldUpdate = false;
        
        for (const pid in room.players) {
           if (room.players[pid].socketId === socket.id) {
               room.players[pid].connected = false;
               room.players[pid].lastSeen = Date.now();
               shouldUpdate = true;
               
               // Set grace period timeout to delete player if they don't return
               setTimeout(() => {
                   if (rooms[roomId] && rooms[roomId].players[pid] && !rooms[roomId].players[pid].connected) {
                       delete rooms[roomId].players[pid];
                       
                       // Handle host leaving
                       if (rooms[roomId].hostId === pid) {
                           const remainingPlayers = Object.keys(rooms[roomId].players);
                           if (remainingPlayers.length > 0) {
                               rooms[roomId].hostId = remainingPlayers[0];
                           } else {
                               delete rooms[roomId];
                               return; // Room empty
                           }
                       }
                       emitRoomUpdate(io, roomId, rooms[roomId]);
                   }
               }, DISCONNECT_GRACE_PERIOD_MS);
           }
        }
        
        if (shouldUpdate) {
            emitRoomUpdate(io, roomId, room);
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
