/** Emotka z paczki zxCode (te same grafiki co w bocie). */
export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return <img src={`/emojis/${name}.png`} width={size} height={size} alt="" className={className} aria-hidden />;
}
