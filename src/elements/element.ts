import { Extrusion } from "./extrusion";
import { Group } from "./group";
import { Level } from "./level";
import { Sketch } from "./sketch";

export type Element = Sketch | Extrusion | Group | Level;

export type ElementLocalFields = {
  hidden: boolean;
}

// List of local fields common to all elements.
export const elementLocalFields = {
  hidden: true,
} satisfies { [P in keyof ElementLocalFields]: true };

export const elementLocalFieldsDefaults: ElementLocalFields = {
  hidden: false,
}
