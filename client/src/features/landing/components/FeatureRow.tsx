import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

// A two-column feature row: copy (tag / title / body) beside a media slot.
// `reverse` swaps sides on md+; on small screens it always stacks copy-first.

type FeatureRowProps = {
  tag: string;
  title: string;
  body: string;
  reverse?: boolean;
  id?: string;
  children: ReactNode;
};

export function FeatureRow({ tag, title, body, reverse = false, id, children }: FeatureRowProps) {
  return (
    <div id={id} className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
      <div className={cn(reverse ? "md:order-2" : "md:order-1")}>
        <div className="text-brass-deep font-mono mb-3.5 text-[11px] font-semibold tracking-[2px] uppercase">
          {tag}
        </div>
        <h3 className="font-display text-ink mb-3.5 text-[clamp(26px,2.6vw,32px)] font-bold tracking-[-0.5px]">
          {title}
        </h3>
        <p className="text-ink-dim max-w-115 text-base leading-[1.65]">{body}</p>
      </div>
      <div className={cn("flex justify-center", reverse ? "md:order-1" : "md:order-2")}>
        {children}
      </div>
    </div>
  );
}
