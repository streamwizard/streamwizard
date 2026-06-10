"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import Image from "next/image";
import { Check } from "lucide-react";

interface SectionWithMockupProps {
  title: string | React.ReactNode;
  description: string | React.ReactNode;
  primaryImageSrc: string;
  secondaryImageSrc: string;
  reverseLayout?: boolean;
  features?: string[];
}

const SectionWithMockup: React.FC<SectionWithMockupProps> = ({
  title,
  description,
  primaryImageSrc,
  reverseLayout = false,
  features,
}) => {
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.2 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
  };

  const textCol = reverseLayout ? "md:col-span-1 md:col-start-3" : "md:col-span-1 md:col-start-1";
  const imageCol = reverseLayout ? "md:col-span-2 md:col-start-1" : "md:col-span-2 md:col-start-2";

  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Ambient section glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${reverseLayout ? "left-0 -translate-x-1/4" : "right-0 translate-x-1/4"} w-[700px] h-[700px] rounded-full`}
          style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.07) 0%, transparent 70%)" }}
        />
      </div>

      <div className="container px-4 mx-auto relative z-10">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 w-full items-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Text */}
          <motion.div className={`flex flex-col items-start gap-5 ${textCol}`} variants={itemVariants}>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">{title}</h2>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">{description}</p>

            {features && features.length > 0 && (
              <ul className="flex flex-col gap-2.5 mt-1">
                {features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-foreground/80">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                      <Check className="h-3 w-3 text-purple-400" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          {/* Image */}
          <motion.div className={`relative ${imageCol} w-full`} variants={itemVariants}>
            {/* Glow behind image */}
            <div
              className="absolute -inset-6 -z-10 rounded-3xl blur-2xl opacity-60"
              style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.2) 0%, transparent 70%)" }}
            />

            {/* Glass frame */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden shadow-[0_0_80px_-20px_rgba(139,92,246,0.25)]">
              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
              <Image
                src={primaryImageSrc}
                alt="StreamWizard Interface"
                width={1440}
                height={900}
                className="w-full h-auto"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div
        className="absolute w-full h-px bottom-0 left-0 z-0"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%)" }}
      />
    </section>
  );
};

export default SectionWithMockup;
