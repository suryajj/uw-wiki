"use client";

import { motion } from "framer-motion";

const LINE_1 = "Honest, student-edited knowledge base for UW";
const LINE_2 = "extracurriculars, design teams, and campus orgs.";

function AnimatedLine({
  text,
  delay = 0,
}: {
  text: string;
  delay?: number;
}) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        className="block"
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{
          duration: 0.7,
          ease: [0.22, 1, 0.36, 1],
          delay,
        }}
      >
        {text}
      </motion.span>
    </span>
  );
}

export function HeroText() {
  return (
    <p className="max-w-5xl text-2xl font-medium leading-snug tracking-tight text-foreground md:text-3xl lg:text-4xl">
      <AnimatedLine text={LINE_1} delay={0.05} />
      <AnimatedLine text={LINE_2} delay={0.18} />
    </p>
  );
}
