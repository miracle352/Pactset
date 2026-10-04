import Image from "next/image";

export function PavilionScene() {
  return (
    <figure className="pavilion-scene" aria-labelledby="pavilion-caption">
      <div className="pavilion-media pavilion-light">
        <Image src="/images/pavilion-light-temporary.webp" alt="Concept artwork of a glass conference pavilion by the water in daylight" fill priority sizes="(max-width: 760px) 100vw, 58vw" />
      </div>
      <div className="pavilion-media pavilion-dark" aria-hidden="true">
        <Image src="/images/pavilion-dark-temporary.webp" alt="" fill priority sizes="(max-width: 760px) 100vw, 58vw" />
      </div>
      <div className="scene-depth" aria-hidden="true" />
      <figcaption id="pavilion-caption" className="temporary-label">
        Temporary pavilion artwork <span>Interactive 3D arrives in Stage 5</span>
      </figcaption>
    </figure>
  );
}
