const LOGO_SRC = "/wfd-logo.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  /** Softer look for footers */
  muted?: boolean;
};

export function BrandLogo({
  className = "h-8 w-auto object-contain",
  alt = "What's for Dinner",
  muted = false,
}: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt={alt}
      className={`${className}${muted ? " opacity-70 grayscale" : ""}`}
    />
  );
}

export { LOGO_SRC };
