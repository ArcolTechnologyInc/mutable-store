import { Element } from "../elements/element";

export function serialize(element: Element): any {
  return {
    ...element.toDebugObj(),
    children: element.children.map(serialize),
  }
}
