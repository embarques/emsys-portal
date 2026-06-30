"use client";

import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

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
  desktopVisibleItems?: number;
  mobileVisibleItems?: number;
};

type StatCardsCarouselTrackProps = {
  children: ReactNode[];
  visibleItems: number;
};

type CarouselHeightStyle = CSSProperties & {
  "--stat-cards-carousel-height": string;
};

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
  visibleItems,
}: StatCardsCarouselTrackProps) {
  return (
    <Carousel
      aria-label="Summary cards"
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
      <CarouselPrevious className="left-0 -translate-x-1/2 shadow-sm" />
      <CarouselNext className="right-0 translate-x-1/2 shadow-sm" />
    </Carousel>
  );
}

function MobileStatCardsCarousel({ children, visibleItems }: StatCardsCarouselTrackProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<CarouselApi>();
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
    const lastVisibleCard = cards[Math.min(visibleItems, cards.length) - 1];
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
        <MobileStatCardsCarousel visibleItems={mobileVisibleItems}>
          {items}
        </MobileStatCardsCarousel>
      </div>
      <div className="hidden sm:block">
        <DesktopStatCardsCarousel visibleItems={desktopVisibleItems}>
          {items}
        </DesktopStatCardsCarousel>
      </div>
    </div>
  );
}
