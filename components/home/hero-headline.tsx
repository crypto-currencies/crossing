import { Reveal } from "@/components/motion";

export function HeroHeadline() {
  return (
    <Reveal className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
      <p className="t-label text-sky-500">What&rsquo;s worth your time?</p>
      <h1 className="t-display-xl mt-3">Find the one worth choosing.</h1>
      <p className="t-subheading mx-auto mt-4 max-w-lg">
        Crossing compares reviews, prices, and opinions across the web, then narrows it to one clear
        answer.
      </p>
    </Reveal>
  );
}
