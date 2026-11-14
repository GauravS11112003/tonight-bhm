"use client";

import dynamic from "next/dynamic";

// three.js needs window, so the canvases load only in the browser.
const ParticleField = dynamic(() => import("./ParticleField"), { ssr: false });
const BedField = dynamic(() => import("./BedField"), { ssr: false });

type Props =
  | { kind: "particles"; lowF: number | null }
  | { kind: "beds"; predicted: number; high: number; spill: number };

export default function ClientCanvas(props: Props) {
  if (props.kind === "particles") return <ParticleField lowF={props.lowF} />;
  return <BedField predicted={props.predicted} high={props.high} spill={props.spill} />;
}
