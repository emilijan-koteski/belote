import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Chapter } from "@/features/rules/components/Chapter";
import { ChapterIndex } from "@/features/rules/components/ChapterIndex";
import { RulesFooter } from "@/features/rules/components/RulesFooter";
import { RulesHero } from "@/features/rules/components/RulesHero";
import { getRulesContent } from "@/features/rules/content/rulesContent";
import { RulesProvider } from "@/features/rules/RulesContext";

export function RulesPage() {
  const { i18n } = useTranslation();
  const content = getRulesContent(i18n.language);
  const sections = content.sections;
  const firstId = sections[0]?.id ?? "";

  const [activeId, setActiveId] = useState(firstId);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    refs.current[id] = el;
  }, []);

  const jump = (id: string) => {
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  // Scroll-spy — highlight the chapter whose header sits closest above the
  // ~140px mark below the sticky top bar.
  useEffect(() => {
    const onScroll = () => {
      let best = firstId;
      for (const s of sections) {
        const el = refs.current[s.id];
        if (!el) continue;
        if (el.getBoundingClientRect().top - 140 <= 0) best = s.id;
      }
      setActiveId(best);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections, firstId]);

  return (
    <RulesProvider value={content}>
      <div
        className="mx-auto flex max-w-270 items-start gap-10 px-7 py-10"
        data-testid="rules-page"
      >
        <ChapterIndex activeId={activeId} onJump={jump} />

        <div className="min-w-0 flex-1">
          <RulesHero />
          {sections.map((s, i) => (
            <Chapter key={s.id} idx={i} section={s} registerRef={registerRef} />
          ))}
          <RulesFooter />
        </div>
      </div>
    </RulesProvider>
  );
}
