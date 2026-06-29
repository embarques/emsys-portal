"use client";

import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CarouselOrientation = "horizontal" | "vertical";

type StatCardsCarouselProps = {
  children: ReactNode;
  className?: string;
  desktopVisibleItems?: number;
  mobileVisibleItems?: number;
};

type StatCardsCarouselTrackProps = {
  children: ReactNode[];
  orientation: CarouselOrientation;
  visibleItems: number;
};

const ITEM_GAP_REM = 1;

function StatCardsCarouselTrack({
  children,
  orientation,
  visibleItems,
}: StatCardsCarouselTrackProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [verticalViewportHeight, setVerticalViewportHeight] = useState<number>();
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(children.length > visibleItems);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const current = orientation === "horizontal" ? viewport.scrollLeft : viewport.scrollTop;
    const maximum =
      orientation === "horizontal"
        ? viewport.scrollWidth - viewport.clientWidth
        : viewport.scrollHeight - viewport.clientHeight;

    setCanScrollPrevious(current > 1);
    setCanScrollNext(maximum - current > 1);
    const firstItem = viewport.querySelector<HTMLElement>("[data-stat-card-carousel-item]");
    const itemStep = firstItem
      ? (orientation === "horizontal" ? firstItem.offsetWidth : firstItem.offsetHeight) + 16
      : 0;
    setFirstVisibleIndex(itemStep ? Math.round(current / itemStep) : 0);
  }, [orientation]);

  const updateVerticalViewportHeight = useCallback(() => {
    if (orientation !== "vertical") return;

    const viewport = viewportRef.current;
    const items = viewport?.querySelectorAll<HTMLElement>("[data-stat-card-carousel-item]");
    if (!viewport || !items?.length) return;

    const lastVisibleItem = items[Math.min(visibleItems, items.length) - 1];
    const firstItem = items[0];
    if (!firstItem || !lastVisibleItem) return;

    setVerticalViewportHeight(
      lastVisibleItem.offsetTop + lastVisibleItem.offsetHeight - firstItem.offsetTop,
    );
  }, [orientation, visibleItems]);

  useLayoutEffect(() => {
    updateVerticalViewportHeight();
  }, [children.length, updateVerticalViewportHeight]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => {
      updateVerticalViewportHeight();
      updateScrollState();
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(viewport);
    viewport
      .querySelectorAll<HTMLElement>("[data-stat-card-carousel-item]")
      .forEach((item) => resizeObserver.observe(item));
    viewport.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateScrollState);
    };
  }, [children.length, updateScrollState, updateVerticalViewportHeight]);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    const firstItem = viewport?.querySelector<HTMLElement>("[data-stat-card-carousel-item]");
    if (!viewport || !firstItem) return;

    const amount =
      orientation === "horizontal"
        ? firstItem.offsetWidth + 16
        : firstItem.offsetHeight + 16;

    if (orientation === "horizontal") {
      viewport.scrollLeft += direction * amount;
    } else {
      viewport.scrollTop += direction * amount;
    }
  }

  const isHorizontal = orientation === "horizontal";
  const previousLabel = isHorizontal ? "Previous cards" : "Previous card";
  const nextLabel = isHorizontal ? "Next cards" : "Next card";
  const PreviousIcon = isHorizontal ? ChevronLeft : ChevronUp;
  const NextIcon = isHorizontal ? ChevronRight : ChevronDown;

  return (
    <div
      aria-label="Summary cards"
      aria-roledescription="carousel"
      className={cn("relative", isHorizontal ? "px-0" : "space-y-2")}
      role="region"
    >
      {!isHorizontal ? (
        <div className="flex justify-end">
          <Button
            aria-label={previousLabel}
            disabled={!canScrollPrevious}
            className="size-8"
            onClick={() => scroll(-1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <PreviousIcon className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={cn(
          "scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isHorizontal
            ? "flex snap-x snap-mandatory gap-4 overflow-x-auto"
            : "flex snap-y snap-mandatory flex-col gap-4 overflow-y-auto overscroll-contain",
        )}
        style={
          !isHorizontal && verticalViewportHeight
            ? { height: verticalViewportHeight }
            : undefined
        }
        tabIndex={0}
      >
        {children.map((child, index) => (
          <div
            aria-label={`${index + 1} of ${children.length}`}
            data-stat-card-carousel-item
            key={index}
            className="min-w-0 shrink-0 snap-start [&>*]:h-full"
            role="group"
            style={
              isHorizontal
                ? {
                    flexBasis: `calc((100% - ${(visibleItems - 1) * ITEM_GAP_REM}rem) / ${visibleItems})`,
                  }
                : undefined
            }
          >
            {child}
          </div>
        ))}
      </div>

      {isHorizontal ? (
        <>
          <Button
            aria-label={previousLabel}
            className="absolute left-0 top-1/2 z-10 size-8 -translate-x-1/2 -translate-y-1/2 shadow-sm"
            disabled={!canScrollPrevious}
            onClick={() => scroll(-1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <PreviousIcon className="h-4 w-4" />
          </Button>
          <Button
            aria-label={nextLabel}
            className="absolute right-0 top-1/2 z-10 size-8 translate-x-1/2 -translate-y-1/2 shadow-sm"
            disabled={!canScrollNext}
            onClick={() => scroll(1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <NextIcon className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {firstVisibleIndex + 1}–
            {Math.min(firstVisibleIndex + visibleItems, children.length)} of {children.length}
          </span>
          <Button
            aria-label={nextLabel}
            className="size-8"
            disabled={!canScrollNext}
            onClick={() => scroll(1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <NextIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable summary-card carousel. It shows a three-card vertical viewport on
 * small screens and a four-card horizontal viewport from the `sm` breakpoint.
 */
export function StatCardsCarousel({
  children,
  className,
  desktopVisibleItems = 4,
  mobileVisibleItems = 3,
}: StatCardsCarouselProps) {
  const items = Children.toArray(children);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="sm:hidden">
        <StatCardsCarouselTrack orientation="vertical" visibleItems={mobileVisibleItems}>
          {items}
        </StatCardsCarouselTrack>
      </div>
      <div className="hidden sm:block">
        <StatCardsCarouselTrack orientation="horizontal" visibleItems={desktopVisibleItems}>
          {items}
        </StatCardsCarouselTrack>
      </div>
    </div>
  );
}
