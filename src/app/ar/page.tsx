import type { Metadata } from "next";
import ExperienciaAR from "@/components/ar/ExperienciaAR";

export const metadata: Metadata = {
  title: "Na sua mesa — Alhoaria",
  description: "Conheça os lanches em 3D, acompanhe a montagem e traga a Alhoaria para a sua mesa em realidade aumentada.",
};
export default function PaginaAR() { return <ExperienciaAR />; }
