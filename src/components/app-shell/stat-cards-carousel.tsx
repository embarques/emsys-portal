"use client";

import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";

import { FlippableStatCard, type StatCardDetail } from "@/components/app-shell/flippable-stat-card";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type StatCardsCarouselProps = {
  children: ReactNode;
  className?: string;
  desktopMinimumVisibleItems?: number;
  desktopMinimumCardWidth?: number;
  mobileLayout?: "carousel" | "stack";
  mobileVisibleItems?: number;
};

export type StatCardItem = {
  label: string;
  value: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  details?: StatCardDetail[];
};

type StatCardsProps = Omit<StatCardsCarouselProps, "children"> & {
  items: StatCardItem[];
};

type StatCardsCarouselTrackProps = {
  children: ReactNode[];
};

type CarouselHeightStyle = CSSProperties & {
  "--stat-cards-carousel-height": string;
};

const CARD_GAP_PX = 16;
const DESKTOP_ARROW_SIZE_PX = 32;
const DESKTOP_ARROW_GUTTER_PX = DESKTOP_ARROW_SIZE_PX + CARD_GAP_PX;

function clampVisibleItems(value: number, minimum: number, itemCount: number) {
  const safeMinimum = Math.min(Math.max(minimum, 1), itemCount);
  return Math.min(Math.max(value, safeMinimum), itemCount);
}

function useCarouselPosition(api: CarouselApi, maximumStartIndex: number) {
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);

  useEffect(() => {
    if (!api) return;

    const updatePosition = () => {
      const selectedIndex = api.selectedScrollSnap();
      const nextIndex = Math.min(selectedIndex, maximumStartIndex);
      setFirstVisibleIndex(nextIndex);
      if (selectedIndex > maximumStartIndex) api.scrollTo(maximumStartIndex);
    };

    updatePosition();
    api.on("select", updatePosition);
    api.on("reInit", updatePosition);

    return () => {
      api.off("select", updatePosition);
      api.off("reInit", updatePosition);
    };
  }, [api, maximumStartIndex]);

  return firstVisibleIndex;
}

function DesktopStatCardsCarousel({
  children,
  minimumCardWidth,
  minimumVisibleItems,
}: StatCardsCarouselTrackProps & {
  minimumCardWidth: number;
  minimumVisibleItems: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleItems, setVisibleItems] = useState(() =>
    clampVisibleItems(minimumVisibleItems, minimumVisibleItems, children.length),
  );

  const updateVisibleItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const contentWidth = Math.max(container.clientWidth - DESKTOP_ARROW_GUTTER_PX * 2, 0);
    const fittingItems = Math.floor(
      (contentWidth + CARD_GAP_PX) / (minimumCardWidth + CARD_GAP_PX),
    );
    const nextVisibleItems = clampVisibleItems(
      fittingItems,
      minimumVisibleItems,
      children.length,
    );
    setVisibleItems((current) =>
      current === nextVisibleItems ? current : nextVisibleItems,
    );
  }, [children.length, minimumCardWidth, minimumVisibleItems]);

  useLayoutEffect(() => {
    updateVisibleItems();
  }, [updateVisibleItems]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(updateVisibleItems);
    resizeObserver.observe(container);
    window.addEventListener("resize", updateVisibleItems);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateVisibleItems);
    };
  }, [updateVisibleItems]);

  return (
    <div ref={containerRef}>
      <Carousel
        aria-label="Summary cards"
        className="px-12"
        opts={{ align: "start", containScroll: "trimSnaps", slidesToScroll: 1 }}
      >
        <CarouselContent>
          {children.map((child, index) => (
            <CarouselItem
              aria-label={`${index + 1} of ${children.length}`}
              className="[&>*]:h-full"
              key={index}
              style={{ flexBasis: `${100 / visibleItems}%` }}
            >
              {child}
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-0 translate-x-0 shadow-sm" />
        <CarouselNext className="right-0 translate-x-0 shadow-sm" />
      </Carousel>
    </div>
  );
}

function MobileStatCardsCarousel({
  children,
  requestedVisibleItems,
}: StatCardsCarouselTrackProps & { requestedVisibleItems: number }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<CarouselApi>();
  const visibleItems = clampVisibleItems(
    requestedVisibleItems,
    requestedVisibleItems,
    children.length,
  );
  const [viewportHeight, setViewportHeight] = useState<number>();
  const maximumStartIndex = Math.max(children.length - visibleItems, 0);
  const firstVisibleIndex = useCarouselPosition(api, maximumStartIndex);

  const updateViewportHeight = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    const cards = Array.from(
      content.querySelectorAll<HTMLElement>("[data-slot='carousel-item'] > *"),
    );
    const firstCard = cards[0];
    const lastVisibleCard = cards[visibleItems - 1];
    if (!firstCard || !lastVisibleCard) return;

    const nextHeight =
      lastVisibleCard.offsetTop + lastVisibleCard.offsetHeight - firstCard.offsetTop;
    if (nextHeight > 0) {
      setViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    }
  }, [visibleItems]);

  useLayoutEffect(() => {
    updateViewportHeight();
  }, [children.length, updateViewportHeight]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(content);
    content
      .querySelectorAll<HTMLElement>("[data-slot='carousel-item'] > *")
      .forEach((card) => resizeObserver.observe(card));

    return () => resizeObserver.disconnect();
  }, [children.length, updateViewportHeight]);

  useEffect(() => {
    if (!viewportHeight || !api) return;

    const frame = requestAnimationFrame(() => api.reInit());
    return () => cancelAnimationFrame(frame);
  }, [api, viewportHeight]);

  const carouselStyle: CarouselHeightStyle = {
    "--stat-cards-carousel-height": viewportHeight ? `${viewportHeight}px` : "auto",
  };

  return (
    <Carousel
      aria-label="Summary cards"
      className="space-y-2 [&_[data-slot=carousel-content]]:h-[var(--stat-cards-carousel-height)]"
      opts={{ align: "start", slidesToScroll: 1 }}
      orientation="vertical"
      setApi={setApi}
      style={carouselStyle}
    >
      <div className="flex justify-end">
        <CarouselPrevious
          className="static ml-auto size-8 translate-x-0 rotate-90"
          disabled={firstVisibleIndex === 0}
          onClick={() => api?.scrollTo(Math.max(firstVisibleIndex - 1, 0))}
        />
      </div>
      <CarouselContent
        className="h-[var(--stat-cards-carousel-height)]"
        ref={contentRef}
      >
        {children.map((child, index) => (
          <CarouselItem
            aria-label={`${index + 1} of ${children.length}`}
            key={index}
            style={{ flexBasis: `calc((100% + 1rem) / ${visibleItems})` }}
          >
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {firstVisibleIndex + 1}–
          {Math.min(firstVisibleIndex + visibleItems, children.length)} of {children.length}
        </span>
        <CarouselNext
          className="static size-8 translate-x-0 rotate-90"
          disabled={firstVisibleIndex >= maximumStartIndex}
          onClick={() => api?.scrollTo(Math.min(firstVisibleIndex + 1, maximumStartIndex))}
        />
      </div>
    </Carousel>
  );
}

function MobileStatCardsStack({ children }: StatCardsCarouselTrackProps) {
  return (
    <div className="space-y-4">
      {children.map((child, index) => (
        <div key={index}>{child}</div>
      ))}
    </div>
  );
}

/**
 * Reusable summary-card carousel. Desktop capacity is calculated from the
 * available width; mobile uses a fixed three-card viewport by default.
 */
export function StatCardsCarousel({
  children,
  className,
  desktopMinimumVisibleItems = 1,
  desktopMinimumCardWidth = 280,
  mobileLayout = "carousel",
  mobileVisibleItems = 3,
}: StatCardsCarouselProps) {
  const items = Children.toArray(children);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="sm:hidden">
        {mobileLayout === "stack" ? (
          <MobileStatCardsStack>{items}</MobileStatCardsStack>
        ) : (
          <MobileStatCardsCarousel requestedVisibleItems={mobileVisibleItems}>
            {items}
          </MobileStatCardsCarousel>
        )}
      </div>
      <div className="hidden sm:block">
        <DesktopStatCardsCarousel
          minimumCardWidth={desktopMinimumCardWidth}
          minimumVisibleItems={desktopMinimumVisibleItems}
        >
          {items}
        </DesktopStatCardsCarousel>
      </div>
    </div>
  );
}

/** Renders a complete responsive carousel from a page's KPI definitions. */
export function StatCards({ items, ...carouselProps }: StatCardsProps) {
  return (
    <StatCardsCarousel {...carouselProps}>
      {items.map((item) => (
        <FlippableStatCard key={item.label} {...item} />
      ))}
    </StatCardsCarousel>
  );
}
