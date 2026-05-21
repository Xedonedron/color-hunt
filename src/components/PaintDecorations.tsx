import { motion } from 'motion/react';

interface Props {
  team?: 'Red' | 'Blue' | null;
}

export default function PaintDecorations({ team }: Props) {
  const isRed = team === 'Red';
  const isBlue = team === 'Blue';

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 15, 0],
          x: [0, 40, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className={`paint-splash w-[800px] h-[800px] -top-60 -left-60 transition-colors duration-500 ${isRed ? 'bg-red-500' : isBlue ? 'bg-blue-400' : 'bg-red-400'}`} 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          rotate: [0, -10, 0],
          x: [0, -50, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className={`paint-splash w-[700px] h-[700px] -bottom-40 -right-40 transition-colors duration-500 ${isRed ? 'bg-orange-500' : isBlue ? 'bg-indigo-500' : 'bg-blue-400'}`} 
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          y: [0, 60, 0]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className={`paint-splash w-[500px] h-[500px] top-1/3 -right-20 transition-colors duration-500 ${isRed ? 'bg-rose-400' : isBlue ? 'bg-cyan-400' : 'bg-yellow-400'}`} 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.4, 1],
          x: [0, 80, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className={`paint-splash w-[600px] h-[600px] bottom-1/4 -left-20 transition-colors duration-500 ${isRed ? 'bg-red-600' : isBlue ? 'bg-sky-500' : 'bg-purple-500'}`} 
      />
    </div>
  );
}
