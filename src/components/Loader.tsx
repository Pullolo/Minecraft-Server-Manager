import { Loader2 } from "lucide-react";
import { cn } from "../utils/utils";

export default function Loader({
  className,
  size,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Loader2
      className={cn(className, "animate-spin")}
      size={size ? size : 20}
    />
  );
}
