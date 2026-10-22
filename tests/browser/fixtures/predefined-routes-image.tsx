import { createElement, type ImgHTMLAttributes } from "react";
// Preserve image dimensions without requiring a Next server in the isolated browser fixture.
export default function Image(props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) {
  return createElement("img", { src: props.src, alt: props.alt ?? "", width: props.width, height: props.height });
}
