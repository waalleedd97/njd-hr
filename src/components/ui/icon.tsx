import { cn } from "@/lib/utils";

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  fill?: boolean;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  size?: number;
}

/**
 * Material Symbols Outlined icon.
 * Usage: <Icon name="home" fill /> or <Icon name="dashboard" size={32} />
 */
export function Icon({
  name,
  fill = false,
  weight = 400,
  size,
  className,
  style,
  ...props
}: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined", fill && "filled", className)}
      style={{
        fontSize: size ? `${size}px` : undefined,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
