"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import Image from "next/image";

interface SectionWithMockupProps {
  title: string | React.ReactNode;
  description: string | React.ReactNode;
  primaryImageSrc: string;
  secondaryImageSrc: string;
  reverseLayout?: boolean;
}

const SectionWithMockup: React.FC<SectionWithMockupProps> = ({ title, description, primaryImageSrc, secondaryImageSrc, reverseLayout = false }) => {
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
  };

  const layoutClasses = "md:grid-cols-3";

  const textOrderClass = reverseLayout ? "md:col-span-1 md:col-start-3" : "md:col-span-1 md:col-start-1";
  const imageOrderClass = reverseLayout ? "md:col-span-2 md:col-start-1" : "md:col-span-2 md:col-start-2";

  return (
    <section className="relative py-24 md:py-48 overflow-hidden">
      <div className="container w-full px-6 md:px-10 relative z-10 mx-auto">
        <motion.div
          className={`grid grid-cols-1 gap-16 md:gap-8 w-full items-center ${layoutClasses}`}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Text Content */}
          <motion.div className={`flex flex-col items-start gap-4 mt-10 md:mt-0 max-w-[546px] mx-auto md:mx-0 ${textOrderClass}`} variants={itemVariants}>
            <div className="space-y-2 md:space-y-1">
              <h2 className="text-white text-3xl md:text-[40px] font-semibold leading-tight md:leading-[53px]">{title}</h2>
            </div>
            <p className="text-[#868f97] text-sm md:text-[15px] leading-6">{description}</p>{" "}
          </motion.div>

          {/* App mockup/Image Content */}
          <motion.div className={`relative mt-10 md:mt-0 mx-auto ${imageOrderClass} w-full max-w-[600px] md:max-w-[1000px]`} variants={itemVariants}>
            {/* Decorative Background Element */}

            {/* Main Mockup Card */}
            <motion.div
              className="relative w-full aspect-video bg-[#ffffff0a]backdrop-brightness-100 border-0 z-10 overflow-hidden"
              initial={{ y: reverseLayout ? 0 : 0 }}
              whileInView={{ y: reverseLayout ? 20 : 30 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
              viewport={{ once: true, amount: 0.5 }}
            >
              <div className="p-0 h-full">
                <div
                  className="h-full relative"
                  style={{
                    backgroundSize: "100% 100%",
                  }}
                >
                  {/* Primary Image */}
                  <Image src={primaryImageSrc} alt="StreamWizard Interface" width={1440} height={900} className="rounded-xl w-full h-auto" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Decorative bottom gradient */}
      <div
        className="absolute w-full h-px bottom-0 left-0 z-0"
        style={{
          background: "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
    </section>
  );
};

export default SectionWithMockup;
