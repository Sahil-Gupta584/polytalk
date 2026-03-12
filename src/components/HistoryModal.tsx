import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { X, Clock, MessageSquareQuote } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const { data: translations, isLoading } = useTranslations();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-zinc-200 dark:border-zinc-800"
          >
            {/* Header */}
            <div className="p-6 sm:px-8 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="text-2xl font-display font-bold flex items-center gap-3 text-zinc-900 dark:text-white">
                <Clock className="w-6 h-6 text-indigo-500" />
                Conversation History
              </h2>
              <button 
                onClick={onClose} 
                className="p-2.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 bg-zinc-50 dark:bg-zinc-950">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center opacity-50 py-20 gap-4">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-medium text-zinc-900 dark:text-white">Loading history...</p>
                </div>
              ) : !translations || translations.length === 0 ? (
                <div className="flex flex-col items-center justify-center opacity-40 py-20 gap-4 text-zinc-900 dark:text-white">
                  <MessageSquareQuote className="w-16 h-16 mb-2" />
                  <p className="text-lg font-medium">No translations yet</p>
                  <p className="text-sm">Your recorded conversations will appear here.</p>
                </div>
              ) : (
                translations.map(t => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={t.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 dark:border-zinc-800/80"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                        <span className="bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md">{t.sourceLanguage}</span>
                        <span>→</span>
                        <span className="bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md">{t.targetLanguage}</span>
                      </div>
                      <span className="text-xs text-zinc-400 font-medium">
                        {t.createdAt ? formatDistanceToNow(new Date(t.createdAt), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">"{t.sourceText}"</p>
                      <p className="text-xl font-display font-semibold text-zinc-900 dark:text-white leading-tight">{t.translatedText}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
