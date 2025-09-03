export default function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Subtle radial glows */}
      <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      {/* Soft grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          color: "rgb(16 185 129)", // emerald-500
        }}
      />
    </div>
  );
}
