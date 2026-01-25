import { motion } from "framer-motion";

export const PageMotion = ({ children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export const SectionMotion = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}          
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);
