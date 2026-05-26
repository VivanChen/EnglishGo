const DEFAULT_IMAGE_BASE = "/images/novels/secret-forest";

export default function NovelIllustration({
  chapter = 1,
  cover = false,
  fill = false,
  small = false,
  imageBase = DEFAULT_IMAGE_BASE,
  title = "The Secret Forest Adventure",
}) {
  const src = cover
    ? `${imageBase}/cover.jpg`
    : small
      ? `${imageBase}/chapter-${chapter}-thumb.jpg`
    : `${imageBase}/chapter-${chapter}.jpg`;
  const height = fill ? "100%" : small ? 150 : cover ? 240 : 360;
  const fit = small || cover ? "cover" : "contain";
  const radius = small ? 0 : 18;

  return (
    <div
      data-testid={fill ? "novel-illustration-frame" : undefined}
      style={{
        height,
        width: fill ? "100%" : undefined,
        borderRadius: radius,
        overflow: "hidden",
        background: "linear-gradient(135deg,#0B3F35,#77C79D)",
        position: "relative",
        boxShadow: small ? "none" : "0 12px 26px rgba(12,56,46,.18)",
      }}
    >
      {!small && !cover && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(14px)",
            transform: "scale(1.08)",
            opacity: 0.42,
          }}
        />
      )}
      <img
        src={src}
        alt={cover ? `${title} cover` : `Chapter ${chapter} illustration`}
        loading="lazy"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          objectFit: fit,
          display: "block",
          filter: small ? "none" : "drop-shadow(0 10px 22px rgba(0,0,0,.18))",
        }}
      />
    </div>
  );
}
