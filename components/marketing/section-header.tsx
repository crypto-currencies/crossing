import { Reveal } from "@/components/motion";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <Reveal className="mb-10 text-center">
      {eyebrow && <p className="t-label text-sky-500">{eyebrow}</p>}
      <h2 className="t-display-md mt-2">{title}</h2>
      {description && <p className="t-body-sm mx-auto mt-3 max-w-md text-[var(--text-secondary)]">{description}</p>}
    </Reveal>
  );
}
