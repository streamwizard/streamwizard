export default function HorizonStage({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Horizon / Stage Effect */}
      <div className="bg-wh relative z-0 -mt-100 h-200 overflow-hidden pointer-events-none mask-[radial-gradient(ellipse_at_center_center,#000,transparent_80%)] before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_center,var(--color-three),transparent_70%)] before:opacity-20 after:content-[''] after:absolute after:left-[-50%] after:top-1/2 after:aspect-[1/0.7] after:w-[200%] after:rounded-[50%] after:[border-top:1px_solid_color-mix(in_srgb,var(--color-three),transparent_50%)] after:bg-background" />

      {/* Children sit above the after: overlay automatically */}
      {children && <div className="absolute bottom-0 left-0 right-0 z-40 flex flex-wrap gap-3 justify-center pb-8">{children}</div>}
    </div>
  );
}
