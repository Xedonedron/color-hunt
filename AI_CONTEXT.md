# AI Context: Color Hunt Party Game

This document provides a comprehensive overview of the Color Hunt repository. It serves as a guide for AI assistants and developers to understand the application's architecture, functionality, and key implementation details.

## 1. Application Overview
**Name**: Color Hunt (Pemburu Warna)
**Description**: A multiplayer parlor game where players use their phone's camera to capture real-world objects that match a randomized target color on the host screen.
**Architecture**: Client-Server architecture utilizing WebSockets for real-time multiplayer synchronization.
- **Client**: React (Vite) Single Page Application (SPA).
- **Server**: Node.js Backend using Express and Socket.IO.

## 2. Technology Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, `lucide-react` (Icons), `motion/react` (Animations).
- **Backend**: Node.js, Express, Socket.IO.
- **Build Tooling**: `vite build` for frontend, `esbuild` for bundling the server into a single CommonJS file. `tsx` for local dev.
- **Camera API**: `navigator.mediaDevices.getUserMedia` for capturing images securely via HTTPS/Localhost.

## 3. Game Flow & Modes
- **INDIVIDUAL Mode**: Every player for themselves. Scores are ranked individually.
- **GROUP Mode**: Players join "Red Team" or "Blue Team". Final scores are aggregated by team.
- **Stages**:
  1. `LOBBY`: Host creates a room. Players join using the room code (4 character string) and choose their team (if GROUP mode).
  2. `TARGET`: Host rolls a random color. Players see a countdown to get ready. The UI shows "MENGACAK..." and a brief spin animation.
  3. `HUNT`: Camera opens on player devices. Players have a few seconds to find and capture the target color. The server handles the timer.
  4. `REVEAL`: The host screen reveals the results of each player, calculating their similarity score against the target.
  5. `FINAL_LEADERBOARD`: Displayed after `maxRounds` is reached. Shows the podium and final team scores (if GROUP mode).

## 4. Key Concepts & Mechanics

### Server-Side Authority
The `server.ts` is the single source of truth for the game state.
- **Rooms**: In-memory storage of active game instances.
- **Stages & Transitions**: The server handles timeouts (e.g., Target -> Hunt, Hunt -> Reveal) to ensure all clients are perfectly synchronized.
- **Calculations**: While the client processes the initial color extraction, the server aggregates scores and determines final outcomes.

### Color Extraction Algorithm (`src/utils/color.ts`)
The `analyzeImageColors` function is responsible for determining the "Captured Color" from a frame.
- **Weighted Grid**: It divides the image into a 3x3 grid.
- **Focus Area**: The center cell (Cell E) has a 40% weight, adjacent cells have 10% each, and corner cells 5% each. This ensures the object the user is centering on contributes most to the dominant color extraction.
- **Delta-E Scoring**: The final color difference is calculated using Euclidean distance in the RGB space, mapped to a percentage score (0-100), with custom thresholds for grades ("Perfect" > 90, "Great" > 80, etc.).

## 5. File & Component Reference

### Root Files
- `server.ts`: The socket.io backend.
  - Understands `room_updated`, `join_room`, `submit_color`, `next_round`, `new_game`, `kick_player`.
  - Important logic: Iterates stages using `setTimeout` triggers starting from when the host proceeds to `TARGET` stage.
- `package.json`: Contains dev and build scripts mapping to Vite and esbuild.

### `src/App.tsx`
- **Role**: Manages the Initial State (MainMenu vs Game).
- **Logic**: Handles socket initialization and creates or joins a room. Evaluates `view === 'HOST'` vs `view === 'PLAYER'` and renders `HostView` or `PlayerView`.

### `src/components/HostView.tsx`
- **Role**: The screen meant to be cast on a TV or displayed on a laptop.
- **Logic**: Watches `roomData.stage` and displays the corresponding view.
  - `LOBBY`: Shows the Room Code and connected players. Allows kicking players.
  - `TARGET`: Displays a rolling color animation that resolves into the objective color.
  - `HUNT`: Displays a countdown timer.
  - `REVEAL`: Maps over players and displays their submitted photos alongside the match percentage.
  - `FINAL_LEADERBOARD`: Activated when `roomData.round > roomData.maxRounds`. Highlights total aggregated points, or group aggregates for "Red" vs "Blue" teams.
- **Events**: Emits `start_game`, `next_round`, `new_game`, `kick_player`.

### `src/components/PlayerView.tsx`
- **Role**: Mobile interface for the participant.
- **Camera Handling**: Uses `useRef<HTMLVideoElement>` to attach a media stream. Captures an image snapshot natively. Uses low-res bounding constraints (`width: { ideal: 640 }`) to avoid freezing mobile GPUs.
- **Logic**: Disables sleep using WakeLock API if available (historically, though keep an eye generally on UI optimization).
- **Events**:
  - Emits `switch_team` (Red/Blue).
  - Listens to timer updates from the server.
  - Takes a 128x128 snapshot and emits `submit_color` directly containing the base64 payload alongside the preliminary extraction analysis.

### Utility Files
- `src/utils/htmlColors.ts`: Array of dictionary items `{ hex, name }` describing target colors (e.g., `#FF4500` - Orange Red). Used by the backend to scatter objective colors.
- `src/utils/color.ts`: Core algorithm for extracting the dominant color with a center-bias, and comparing RGB Euclidean distances.

## 6. How To Make Changes
- **When adding new packet types**: Define the payload interface in both `server.ts` and the component firing the event. Ensure `roomData` state is kept immutable and propagated down using `emitRoomUpdate()`.
- **When modifying the color algorithm**: Tweak the weight constants or the `Delta E` formula inside `src/utils/color.ts` directly.
- **When managing states over boundaries**: Note that `HostView` and `PlayerView` might maintain individual `localStage` for animation transitions (e.g., showing a cinematic curtain before revealing), make sure not to desync them permanently from `roomData.stage`.
