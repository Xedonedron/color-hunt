import { motion } from 'motion/react';

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
      <div className="absolute inset-0 bg-[#f8f9fa] google-stitch-bg" />
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-yellow-400/30 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{
          x: [0, -100, 0],
          y: [0, -50, 0],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] bg-[#4152ff]/30 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, 50, -50, 0],
          y: [0, 100, -100, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-[20%] left-[30%] w-[40%] h-[40%] bg-pink-400/20 rounded-full blur-[100px]"
      />
    </div>
  );
}
