/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Pause, Heart } from 'lucide-react';

// --- Constants ---
const TILE_SIZE = 20;
const GRID_WIDTH = 19;
const GRID_HEIGHT = 21;
const GAME_WIDTH = GRID_WIDTH * TILE_SIZE;
const GAME_HEIGHT = GRID_HEIGHT * TILE_SIZE;

const SPEEDS = {
  PACMAN: 2,
  GHOST: 1.5,
  SCARED_GHOST: 1,
};

const COLORS = {
  WALL: '#0033ff', // Electric Blue
  WALL_GLOW: 'rgba(0, 51, 255, 0.5)',
  DOT: '#ffffff',
  POWER: '#ff00ff', // Neon Pink
  PACMAN: '#ffff00', // Classic Yellow
  GHOSTS: {
    BLINKY: '#ff0000', // Red
    PINKY: '#ffb8ff', // Pink
    INKY: '#00ffff', // Cyan
    CLYDE: '#ffb852', // Orange
    SCARED: '#1919a6', // Deep Blue
    FLASHING: '#ffffff',
  }
};

// 0: Empty, 1: Wall, 2: Dot, 3: Power Pellet, 4: Ghost House Door, 5: Pacman Start, 6: Ghost Start
const INITIAL_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 3, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 3, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1],
  [0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0],
  [1, 1, 1, 1, 2, 1, 0, 1, 1, 4, 1, 1, 0, 1, 2, 1, 1, 1, 1],
  [0, 0, 0, 0, 2, 0, 0, 1, 6, 6, 6, 1, 0, 0, 2, 0, 0, 0, 0],
  [1, 1, 1, 1, 2, 1, 0, 1, 6, 6, 6, 1, 0, 1, 2, 1, 1, 1, 1],
  [0, 0, 0, 1, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 2, 1, 0, 0, 0],
  [1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 1, 1, 2, 1],
  [1, 3, 2, 1, 2, 2, 2, 2, 5, 2, 2, 2, 2, 2, 2, 1, 2, 3, 1],
  [1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1],
  [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null;

interface Ghost {
  id: string;
  pos: Point;
  dir: Direction;
  color: string;
  type: 'BLINKY' | 'PINKY' | 'INKY' | 'CLYDE';
  status: 'NORMAL' | 'SCARED' | 'EYES';
  spawnPos: Point;
}

const PacmanGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'WON'>('START');
  const [map, setMap] = useState<number[][]>(() => INITIAL_MAP.map(row => [...row]));
  
  // Game state refs for the loop
  const pacmanRef = useRef({
    pos: { x: 9 * TILE_SIZE, y: 15 * TILE_SIZE },
    dir: null as Direction,
    nextDir: null as Direction,
    rotation: 0,
    mouthOpen: 0,
    mouthClosing: false
  });

  const ghostsRef = useRef<Ghost[]>([
    { id: 'blinky', pos: { x: 9 * TILE_SIZE, y: 9 * TILE_SIZE }, dir: 'LEFT', color: COLORS.GHOSTS.BLINKY, type: 'BLINKY', status: 'NORMAL', spawnPos: { x: 9 * TILE_SIZE, y: 9 * TILE_SIZE } },
    { id: 'pinky', pos: { x: 8 * TILE_SIZE, y: 10 * TILE_SIZE }, dir: 'RIGHT', color: COLORS.GHOSTS.PINKY, type: 'PINKY', status: 'NORMAL', spawnPos: { x: 8 * TILE_SIZE, y: 10 * TILE_SIZE } },
    { id: 'inky', pos: { x: 9 * TILE_SIZE, y: 10 * TILE_SIZE }, dir: 'UP', color: COLORS.GHOSTS.INKY, type: 'INKY', status: 'NORMAL', spawnPos: { x: 9 * TILE_SIZE, y: 10 * TILE_SIZE } },
    { id: 'clyde', pos: { x: 10 * TILE_SIZE, y: 10 * TILE_SIZE }, dir: 'LEFT', color: COLORS.GHOSTS.CLYDE, type: 'CLYDE', status: 'NORMAL', spawnPos: { x: 10 * TILE_SIZE, y: 10 * TILE_SIZE } },
  ]);

  const powerPelletTimerRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);

  // --- Helpers ---
  const isWall = useCallback((x: number, y: number, currentMap: number[][]) => {
    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    // Warp world support (left/right)
    if (gridX < 0 || gridX >= GRID_WIDTH) return false;
    if (gridY < 0 || gridY >= GRID_HEIGHT) return true;

    const tile = currentMap[gridY][gridX];
    return tile === 1;
  }, []);

  const canMove = useCallback((pos: Point, dir: Direction, currentMap: number[][]) => {
    if (!dir) return false;
    
    // Check if movement is aligned to grid for turning
    const isAlignedX = pos.x % TILE_SIZE === 0;
    const isAlignedY = pos.y % TILE_SIZE === 0;

    let nextX = pos.x;
    let nextY = pos.y;

    if (dir === 'UP') nextY -= 1;
    if (dir === 'DOWN') nextY += TILE_SIZE;
    if (dir === 'LEFT') nextX -= 1;
    if (dir === 'RIGHT') nextX += TILE_SIZE;

    // Check corners of the pacman box
    const radius = TILE_SIZE / 2;
    const margin = 2; // Small margin to prevent sticking
    
    if (dir === 'UP' || dir === 'DOWN') {
        if (!isAlignedX) return false;
        return !isWall(pos.x, nextY, currentMap) && !isWall(pos.x + TILE_SIZE - 1, nextY, currentMap);
    } else {
        if (!isAlignedY) return false;
        return !isWall(nextX, pos.y, currentMap) && !isWall(nextX, pos.y + TILE_SIZE - 1, currentMap);
    }
  }, [isWall]);

  const handlePowerPellet = useCallback(() => {
    if (powerPelletTimerRef.current) clearTimeout(powerPelletTimerRef.current);
    
    ghostsRef.current = ghostsRef.current.map(g => ({
      ...g,
      status: g.status === 'EYES' ? 'EYES' : 'SCARED'
    }));

    powerPelletTimerRef.current = window.setTimeout(() => {
      ghostsRef.current = ghostsRef.current.map(g => ({
        ...g,
        status: g.status === 'SCARED' ? 'NORMAL' : g.status
      }));
      powerPelletTimerRef.current = null;
    }, 7000);
  }, []);

  const resetPositions = useCallback(() => {
    pacmanRef.current = {
      pos: { x: 9 * TILE_SIZE, y: 15 * TILE_SIZE },
      dir: null,
      nextDir: null,
      rotation: 0,
      mouthOpen: 0,
      mouthClosing: false
    };
    ghostsRef.current = ghostsRef.current.map(g => ({
      ...g,
      pos: { ...g.spawnPos },
      dir: 'UP',
      status: 'NORMAL'
    }));
  }, []);

  const startGame = () => {
    setGameState('PLAYING');
    setLives(3);
    setScore(0);
    setMap(INITIAL_MAP.map(row => [...row]));
    resetPositions();
  };

  const restartGameFull = () => {
    startGame();
  };

  // --- Rendering ---
  const draw = useCallback((ctx: CanvasRenderingContext2D, currentMap: number[][]) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Map
    currentMap.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile === 1) {
          ctx.fillStyle = COLORS.WALL;
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.WALL_GLOW;
          
          // Draw neat blockish walls
          ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = COLORS.WALL;
          ctx.lineWidth = 1;
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          ctx.shadowBlur = 0;
        } else if (tile === 2) {
          ctx.fillStyle = COLORS.DOT;
          ctx.beginPath();
          ctx.arc(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 3) {
          ctx.fillStyle = COLORS.POWER;
          ctx.shadowBlur = 8;
          ctx.shadowColor = COLORS.POWER;
          ctx.beginPath();
          ctx.arc(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    });

    // Draw Pac-Man
    const p = pacmanRef.current;
    ctx.save();
    ctx.translate(p.pos.x + TILE_SIZE / 2, p.pos.y + TILE_SIZE / 2);
    ctx.rotate(p.rotation);
    ctx.fillStyle = COLORS.PACMAN;
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.PACMAN;
    ctx.beginPath();
    const mouthAngle = (p.mouthOpen / 20) * Math.PI;
    ctx.arc(0, 0, TILE_SIZE / 2 - 1, mouthAngle, Math.PI * 2 - mouthAngle);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    // Draw Ghosts
    ghostsRef.current.forEach(g => {
      ctx.save();
      ctx.translate(g.pos.x + TILE_SIZE / 2, g.pos.y + TILE_SIZE / 2);
      
      const headRadius = TILE_SIZE / 2 - 2;
      
      if (g.status === 'SCARED') {
        const isExpiring = powerPelletTimerRef.current !== null && 
                          (Date.now() % 400 < 200); // Flashing effect
        ctx.fillStyle = isExpiring ? COLORS.GHOSTS.FLASHING : COLORS.GHOSTS.SCARED;
      } else if (g.status === 'EYES') {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
      } else {
        ctx.fillStyle = g.color;
      }
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = ctx.fillStyle as string;

      // Base shape
      ctx.beginPath();
      ctx.arc(0, -2, headRadius, Math.PI, 0);
      ctx.lineTo(headRadius, headRadius);
      // Wavy bottom
      for (let i = 0; i < 3; i++) {
        const segWidth = (headRadius * 2) / 3;
        ctx.lineTo(headRadius - i * segWidth - segWidth / 2, headRadius - (i % 2 === 0 ? 3 : 0));
      }
      ctx.lineTo(-headRadius, headRadius);
      ctx.closePath();
      ctx.fill();
      
      // Eyes
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      const lookOffset = { x: 0, y: 0 };
      if (g.dir === 'UP') lookOffset.y = -2;
      if (g.dir === 'DOWN') lookOffset.y = 2;
      if (g.dir === 'LEFT') lookOffset.x = -2;
      if (g.dir === 'RIGHT') lookOffset.x = 2;

      ctx.beginPath();
      ctx.arc(-4 + lookOffset.x, -3 + lookOffset.y, 3, 0, Math.PI * 2);
      ctx.arc(4 + lookOffset.x, -3 + lookOffset.y, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-4 + lookOffset.x * 1.5, -3 + lookOffset.y * 1.5, 1.5, 0, Math.PI * 2);
      ctx.arc(4 + lookOffset.x * 1.5, -3 + lookOffset.y * 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }, []);

  // --- Game Loop Logic ---
  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    setMap(prevMap => {
        const nextMap = [...prevMap.map(row => [...row])];
        const p = pacmanRef.current;

        // --- Pacman Movement ---
        // Try to change direction
        if (p.nextDir && canMove(p.pos, p.nextDir, nextMap)) {
            p.dir = p.nextDir;
            p.nextDir = null;
        }

        if (p.dir && canMove(p.pos, p.dir, nextMap)) {
            if (p.dir === 'UP') { p.pos.y -= SPEEDS.PACMAN; p.rotation = -Math.PI / 2; }
            if (p.dir === 'DOWN') { p.pos.y += SPEEDS.PACMAN; p.rotation = Math.PI / 2; }
            if (p.dir === 'LEFT') { p.pos.x -= SPEEDS.PACMAN; p.rotation = Math.PI; }
            if (p.dir === 'RIGHT') { p.pos.x += SPEEDS.PACMAN; p.rotation = 0; }

            // Warp world
            if (p.pos.x < -TILE_SIZE) p.pos.x = GAME_WIDTH;
            if (p.pos.x > GAME_WIDTH) p.pos.x = -TILE_SIZE;

            // Mouth animation
            if (p.mouthClosing) {
                p.mouthOpen -= 1.5;
                if (p.mouthOpen <= 0) p.mouthClosing = false;
            } else {
                p.mouthOpen += 1.5;
                if (p.mouthOpen >= 10) p.mouthClosing = true;
            }

            // --- Eat Collectibles ---
            const gridX = Math.round(p.pos.x / TILE_SIZE);
            const gridY = Math.round(p.pos.y / TILE_SIZE);
            
            if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT) {
                const tile = nextMap[gridY][gridX];
                if (tile === 2) {
                    nextMap[gridY][gridX] = 0;
                    setScore(s => s + 10);
                } else if (tile === 3) {
                    nextMap[gridY][gridX] = 0;
                    setScore(s => s + 50);
                    handlePowerPellet();
                }
            }
        }

        // --- Ghost Movement ---
        ghostsRef.current.forEach(g => {
            const speed = g.status === 'SCARED' ? SPEEDS.SCARED_GHOST : SPEEDS.GHOST;
            
            // Basic movement: Move forward, if hit wall or at junction, choose new direction
            const isAtJunction = (g.pos.x % TILE_SIZE === 0 && g.pos.y % TILE_SIZE === 0);
            
            if (isAtJunction) {
                const possibleDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
                const oppositeDir: Record<string, Direction> = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };
                
                const validDirs = possibleDirs.filter(d => 
                    d !== oppositeDir[g.dir as string] && canMove(g.pos, d, nextMap)
                );

                if (validDirs.length > 0) {
                    // Simple AI: Chasing or Random
                    if (g.status === 'NORMAL') {
                        // Move towards pacman
                        validDirs.sort((a, b) => {
                            const dist = (dir: Direction) => {
                                let nx = g.pos.x, ny = g.pos.y;
                                if (dir === 'UP') ny -= TILE_SIZE;
                                if (dir === 'DOWN') ny += TILE_SIZE;
                                if (dir === 'LEFT') nx -= TILE_SIZE;
                                if (dir === 'RIGHT') nx += TILE_SIZE;
                                return Math.pow(nx - p.pos.x, 2) + Math.pow(ny - p.pos.y, 2);
                            };
                            return dist(a) - dist(b);
                        });
                        g.dir = validDirs[0];
                    } else if (g.status === 'SCARED') {
                        // Move away from pacman
                         validDirs.sort((a, b) => {
                            const dist = (dir: Direction) => {
                                let nx = g.pos.x, ny = g.pos.y;
                                if (dir === 'UP') ny -= TILE_SIZE;
                                if (dir === 'DOWN') ny += TILE_SIZE;
                                if (dir === 'LEFT') nx -= TILE_SIZE;
                                if (dir === 'RIGHT') nx += TILE_SIZE;
                                return Math.pow(nx - p.pos.x, 2) + Math.pow(ny - p.pos.y, 2);
                            };
                            return dist(b) - dist(a);
                        });
                        g.dir = validDirs[0];
                    } else {
                        // Eyes: Return to spawn
                         validDirs.sort((a, b) => {
                            const dist = (dir: Direction) => {
                                let nx = g.pos.x, ny = g.pos.y;
                                if (dir === 'UP') ny -= TILE_SIZE;
                                if (dir === 'DOWN') ny += TILE_SIZE;
                                if (dir === 'LEFT') nx -= TILE_SIZE;
                                if (dir === 'RIGHT') nx += TILE_SIZE;
                                return Math.pow(nx - g.spawnPos.x, 2) + Math.pow(ny - g.spawnPos.y, 2);
                            };
                            return dist(a) - dist(b);
                        });
                        g.dir = validDirs[0];
                    }
                } else {
                    // Move backwards if blocked entirely (rare)
                    g.dir = oppositeDir[g.dir as string];
                }
            }

            if (g.dir === 'UP') g.pos.y -= speed;
            if (g.dir === 'DOWN') g.pos.y += speed;
            if (g.dir === 'LEFT') g.pos.x -= speed;
            if (g.dir === 'RIGHT') g.pos.x += speed;

            // Warp
            if (g.pos.x < -TILE_SIZE) g.pos.x = GAME_WIDTH;
            if (g.pos.x > GAME_WIDTH) g.pos.x = -TILE_SIZE;

            // --- Collisions ---
            const dist = Math.sqrt(Math.pow(p.pos.x - g.pos.x, 2) + Math.pow(p.pos.y - g.pos.y, 2));
            if (dist < TILE_SIZE * 0.8) {
                if (g.status === 'NORMAL') {
                    setLives(prev => {
                        if (prev <= 1) {
                            setGameState('GAMEOVER');
                            return 0;
                        }
                        resetPositions();
                        return prev - 1;
                    });
                } else if (g.status === 'SCARED') {
                    g.status = 'EYES';
                    setScore(s => s + 200);
                }
            }

            // Return home
            if (g.status === 'EYES' && 
                Math.abs(g.pos.x - g.spawnPos.x) < 5 && 
                Math.abs(g.pos.y - g.spawnPos.y) < 5) {
                g.status = 'NORMAL';
            }
        });

        // Check for Win
        const dotCount = nextMap.flat().filter(t => t === 2 || t === 3).length;
        if (dotCount === 0) {
            setGameState('WON');
        }

        return nextMap;
    });
  }, [gameState, canMove, resetPositions, handlePowerPellet]);

  const loop = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
        update();
        draw(ctx, map);
    }
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw, map]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') pacmanRef.current.nextDir = 'UP';
        if (e.key === 'ArrowDown') pacmanRef.current.nextDir = 'DOWN';
        if (e.key === 'ArrowLeft') pacmanRef.current.nextDir = 'LEFT';
        if (e.key === 'ArrowRight') pacmanRef.current.nextDir = 'RIGHT';
        
        if (e.key === ' ') {
            setGameState(prev => prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden select-none">
      {/* Navbar */}
      <nav className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-slate-900 border-b-[8px] border-b-transparent translate-x-2"></div>
          </div>
          <span className="font-bold text-xl tracking-tight text-white italic">
            PAC-OS <span className="text-blue-500 font-normal not-italic">PROFESSIONAL</span>
          </span>
        </div>
        
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <span className="text-white border-b-2 border-blue-500 pb-5 translate-y-[2px]">遊戲大廳</span>
          <span>賽事數據</span>
          <span>社群排名</span>
          <span>系統設定</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">目前得分</div>
            <div className="text-xl font-mono text-yellow-400 leading-none glow-text">{score.toLocaleString()}</div>
          </div>
          <div className="w-10 h-10 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden">
             <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${"PacUser"}`} alt="avatar" />
          </div>
        </div>
      </nav>

      {/* Main Layout Area */}
      <main className="flex-1 flex gap-6 p-6 overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900">
        
        {/* Left Sidebar: Status */}
        <aside className="w-64 hidden xl:flex flex-col gap-6 animate-in slide-in-from-left duration-700">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              玩家狀態
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">剩餘生命</span>
                <div className="flex gap-1.5">
                  {[...Array(3)].map((_, i) => (
                    <motion.div 
                        key={i}
                        animate={{ 
                            scale: i < lives ? 1 : 0.8,
                            opacity: i < lives ? 1 : 0.2
                        }}
                        className={`w-3.5 h-3.5 rounded-full ${i < lives ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-slate-700'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">當前關卡</span>
                <span className="text-sm font-bold text-blue-400">Lv. 01</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                    <span>進度</span>
                    <span>{Math.floor((score / 2500) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (score / 2500) * 100)}%` }}
                        className="bg-blue-500 h-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                    />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center uppercase tracking-tighter">
                {score < 2500 ? `距離下一次獎勵分：${(2500 - score).toLocaleString()}` : '已達到最高獎勵目標'}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              道具清單
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col items-center hover:bg-slate-800 transition-colors cursor-help">
                <div className="text-xl mb-1">🍒</div>
                <span className="text-[10px] uppercase font-bold text-slate-300">櫻桃 x0</span>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col items-center hover:bg-slate-800 transition-colors cursor-help">
                <div className="text-xl mb-1">🍓</div>
                <span className="text-[10px] uppercase font-bold text-slate-300">草莓 x0</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Game Canvas */}
        <section className="flex-1 flex flex-col items-center justify-center relative">
          <div className="relative group">
            {/* Glow background */}
            <div className="absolute -inset-4 bg-blue-600 rounded-[2rem] blur-2xl opacity-10 group-hover:opacity-20 transition duration-1000"></div>
            
            <div className="relative bg-black border-4 border-slate-800 rounded-2xl overflow-hidden p-3 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <canvas
                  ref={canvasRef}
                  width={GAME_WIDTH}
                  height={GAME_HEIGHT}
                  className="bg-black rounded-lg"
                />

                {/* Overlays */}
                <AnimatePresence>
                    {gameState === 'START' && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 backdrop-blur-md"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h1 className="text-5xl font-black mb-2 text-white tracking-tighter italic">
                                    READY!
                                </h1>
                                <p className="text-xs text-blue-400 mb-10 uppercase tracking-[0.4em] font-medium">按 START 開始大挑戰</p>
                                
                                <button 
                                    onClick={startGame}
                                    className="group relative px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all duration-300 transform active:scale-95 shadow-xl shadow-blue-900/40"
                                >
                                    <span className="flex items-center gap-3 font-bold uppercase tracking-widest text-sm text-white">
                                        <Play size={20} fill="currentColor" /> Start Operation
                                    </span>
                                </button>
                            </motion.div>
                        </motion.div>
                    )}

                    {gameState === 'PAUSED' && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-10 bg-slate-950/60 flex items-center justify-center backdrop-blur-sm"
                        >
                            <div className="text-center">
                                <h2 className="text-4xl font-black text-white mb-6 italic tracking-widest drop-shadow-2xl">SYSTEM PAUSED</h2>
                                <button 
                                    onClick={() => setGameState('PLAYING')}
                                    className="p-6 bg-blue-600 hover:bg-blue-500 rounded-full transition-all hover:scale-110 shadow-2xl"
                                >
                                    <Play size={40} fill="white" className="text-white" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {(gameState === 'GAMEOVER' || gameState === 'WON') && (
                        <motion.div 
                            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
                            className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center p-6"
                        >
                            <div className="relative mb-6">
                                {gameState === 'WON' ? (
                                    <Trophy size={80} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
                                ) : (
                                    <div className="text-7xl">💀</div>
                                )}
                            </div>
                            <h2 className={`text-5xl font-black mb-2 tracking-tighter italic ${gameState === 'WON' ? 'text-yellow-400' : 'text-red-500'}`}>
                                {gameState === 'WON' ? 'MISSION SUCCESS' : 'TERMINATED'}
                            </h2>
                            <div className="text-2xl font-mono mb-10 text-slate-300 tracking-tight">
                               FINAL SCORE: <span className="text-white">{score.toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={restartGameFull}
                                className="flex items-center gap-3 px-10 py-4 bg-white text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-blue-50 transition-all active:scale-95 shadow-2xl"
                            >
                                <RotateCcw size={20} /> Restart System
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="mt-6 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom duration-1000">
                <div className="flex gap-3">
                    {['▲', '▼', '◄', '►'].map(k => (
                        <div key={k} className="w-12 h-12 border-2 border-slate-800 rounded-xl flex items-center justify-center text-slate-400 bg-slate-900/50 font-bold text-lg shadow-inner">
                            {k}
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Use arrows to navigate • Space to pause</p>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Rankings */}
        <aside className="w-72 hidden lg:flex flex-col gap-6 animate-in slide-in-from-right duration-700">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl flex-1 p-5 flex flex-col backdrop-blur-sm overflow-hidden">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
              全球排名 (24H)
            </h3>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {[
                { rank: '01', name: 'Alex Pro', score: '2,450,000', online: true },
                { rank: '02', name: 'CyberMage', score: '1,980,400', online: false },
                { rank: '03', name: 'PillPopper', score: '1,822,100', online: true },
                { rank: '04', name: 'GhostHunter', score: '1,540,000', online: false },
                { rank: '05', name: 'PacMaster', score: '1,220,000', online: false },
              ].map((item, i) => (
                <div 
                    key={i} 
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${i === 0 ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/60'}`}
                >
                  <span className={`font-mono font-bold ${i === 0 ? 'text-blue-400' : 'text-slate-500'}`}>{item.rank}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">{item.name}</div>
                    <div className="text-[10px] text-slate-500 italic uppercase">{item.score} pts</div>
                  </div>
                  {item.online && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>}
                </div>
              ))}
            </div>
            <div className="mt-6">
              <button className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 transition-all text-sm uppercase tracking-widest active:scale-95">
                排行榜詳情
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 backdrop-blur-sm">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">系統延遲</span>
              <span className="text-[10px] font-mono text-green-400 font-bold">18MS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">核心版本</span>
              <span className="text-[10px] font-mono text-slate-400">v2.4.1-STABLE</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[9px] text-slate-500 font-bold uppercase">加密連線已建立</span>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 px-8 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest shrink-0">
        <div className="flex gap-8">
          <span className="hover:text-slate-300 transition-colors cursor-pointer">© 2026 PAC-OS CORE</span>
          <span className="hover:text-slate-300 transition-colors cursor-pointer">服務條款</span>
          <span className="hover:text-slate-300 transition-colors cursor-pointer">隱私權政策</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
             <div className="w-1 h-3 bg-blue-500/40 rounded-full"></div>
             <div className="w-1 h-3 bg-blue-500/60 rounded-full"></div>
             <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
          </div>
          <span>伺服器狀態：良好</span>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .glow-text {
            text-shadow: 0 0 10px rgba(250, 204, 21, 0.4);
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(59, 130, 246, 0.3);
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(59, 130, 246, 0.5);
        }
      `}} />
    </div>
  );
};

export default PacmanGame;
