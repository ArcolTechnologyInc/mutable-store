import { Extrusion } from "./extrusion";
import { Group } from "./group";
import { Level } from "./level";
import { Sketch } from "./sketch";

export type Element = Sketch | Extrusion | Group | Level;

export type ElementLocalFields = {
  hidden: boolean;
}

export const elementLocalFieldsDefaults: ElementLocalFields = {
  hidden: false,
}
