export default function Spinner() {
  return (
    <span className="relative flex h-5 w-5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-75" />
      <span className="relative inline-flex h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    </span>
  );
}
