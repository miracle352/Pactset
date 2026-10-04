import Image from "next/image";

export function PavilionScene() {
  return (
    <figure className="pavilion-scene" role="img" aria-label="Glass event pavilion overlooking calm water and mountains">
      <div className="pavilion-media pavilion-light" aria-hidden="true">
        <Image src="/images/pavilion-light.webp" alt="" fill priority sizes="100vw" />
      </div>
      <div className="pavilion-media pavilion-dark" aria-hidden="true">
        <Image src="/images/pavilion-dark.webp" alt="" fill priority sizes="100vw" />
      </div>
      <div className="scene-treatment" aria-hidden="true" />
    </figure>
  );
}
