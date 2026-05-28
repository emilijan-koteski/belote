import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "bg-surface-elevated text-ink placeholder:text-ink-off h-8 w-full min-w-0 rounded-[10px] border border-border px-3.5 py-1 text-sm transition-[border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-border-2 focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_rgba(139,42,31,0.10)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
