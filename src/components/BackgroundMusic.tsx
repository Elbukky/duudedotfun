import { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BackgroundMusic = () => {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem("background-music-muted");
    return saved === "true";
  });
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.3;

    const playAudio = () => {
      if (!isMuted && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    playAudio();

    const handleInteraction = () => playAudio();
    document.addEventListener("click", handleInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleInteraction);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    localStorage.setItem("background-music-muted", String(isMuted));
  }, [isMuted]);

  return (
    <>
      <audio
        ref={audioRef}
        src="/Crickets_and_Frogs_Chirping_with_Dog_Barks_in_the_Background_Version (1).mp3"
        preload="auto"
      />
      <AnimatePresence>
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => setIsMuted(!isMuted)}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-background/80 backdrop-blur-md border-2 border-primary/30 hover:border-primary/60 shadow-lg hover:shadow-primary/20 transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={isMuted ? "Unmute background music" : "Mute background music"}
        >
          {isMuted ? (
            <VolumeX size={22} className="text-muted-foreground" />
          ) : (
            <Volume2 size={22} className="text-primary" />
          )}
        </motion.button>
      </AnimatePresence>
    </>
  );
};

export default BackgroundMusic;
