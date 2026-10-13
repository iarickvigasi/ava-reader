import type { ComponentType, SVGProps } from "react";

type PageHeaderProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrow: string;
  title: string;
  description: string;
  titleId: string;
};

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  titleId,
}: PageHeaderProps) {
  return (
    <div className="max-w-3xl space-y-5">
      <p className="inline-flex items-center gap-3 font-ui text-[0.675rem] font-bold uppercase tracking-[0.16em] text-muted sm:text-[0.625rem]">
        <Icon aria-hidden="true" className="size-4 text-muted" />
        {eyebrow}
      </p>
      <h1 id={titleId} className="font-display text-4xl text-ink sm:text-5xl">
        {title}
      </h1>
      <p className="max-w-2xl text-xl leading-8 text-copy sm:text-2xl sm:leading-9">
        {description}
      </p>
    </div>
  );
}
