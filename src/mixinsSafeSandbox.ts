import { Brand } from "./fileFormat";
import { Vec3 } from "./projectTypes";

abstract class ElementBase<TID, TFields> {
  abstract type: string
  id: TID
  abstract fields: TFields
  constructor(id: TID) {
    this.id = id;
  }
}

abstract class ArcolElementBase<TFields> extends ElementBase<ArcolElementId, TFields> { }
type ArcolElementId = Brand<string, "arcol-element-id">

//////////////////////////////////////////////////////////////////////////////////////////
// Components w/ Mixins

type GenericConstructor<T> = new (...args: any[]) => T

type HierarchyFields<TID> = {
  parentId: TID | null
}

const HierarchyDefaults: HierarchyFields<any> = {
  parentId: null,
}

type IHierarchyElement<TID> = {
  fields: HierarchyFields<TID>
}

function HierarchyMixin<TID, TElement extends ElementBase<TID, any>, TBase extends GenericConstructor<IHierarchyElement<TID>>>(Base: TBase) {
  return class extends Base {
    private _cachedChildren: TElement[] = []
    get parentId() {
      return this.fields.parentId;
    }
    set parentId(value: TID | null) {
      this.fields.parentId = value;
    }
    get children() {
      return this._cachedChildren;
    }
  }
}

function ArcolHierarchyMixin<TElement extends ArcolElementBase<any>, TBase extends GenericConstructor<IHierarchyElement<ArcolElementId>>>(Base: TBase) {
  return HierarchyMixin<ArcolElementId, TElement, TBase>(Base)
}

type HideableFields = {
  hidden: boolean
}

interface IHideableElement {
  fields: HideableFields
}

const HideableDefaults: HideableFields = {
  hidden: false
}

function HideableMixin<TBase extends GenericConstructor<IHideableElement>>(Base: TBase) {
  return class extends Base {
    get hidden() {
      return this.fields.hidden;
    }
    set hidden(value: boolean) {
      this.fields.hidden = value;
    }
  }
}

type SketchFields = {
  translate: Vec3
  color: `#${string}`
}

const SketchDefaults: SketchFields = {
  translate: [0, 0, 0],
  color: "#aaa"
}

interface ISketchElement {
  fields: SketchFields
}

function SketchMixin<TBase extends GenericConstructor<ISketchElement>>(Base: TBase) {
  return class extends Base {
    get translate() {
      return this.fields.translate;
    }
    set translate(value: Vec3) {
      this.fields.translate = value;
    }

    get color() {
      return this.fields.color;
    }
    set color(value: `#${string}`) {
      this.fields.color = value;
    }
  }
}

type ExtrusionFields = {
  height: number
  sketchId: string | null
}

const ExtrusionDefaults: ExtrusionFields = {
  height: 0,
  sketchId: null
}

interface IExtrusionElement {
  fields: ExtrusionFields
}

function ExtrusionMixin<TBase extends GenericConstructor<IExtrusionElement>>(Base: TBase) {
  return class extends Base {
    get height() {
      return this.fields.height;
    }
    set height(value: number) {
      this.fields.height = value;
    }

    get sketchId() {
      return this.fields.sketchId;
    }
    set sketchId(value: string | null) {
      this.fields.sketchId = value;
    }
  }
}

//////////////////////////////////////////////////////////////////////////////////////////
// Elements

class _ArcolSketch extends ArcolElementBase<SketchFields & HideableFields & HierarchyFields<ArcolElementId>> {
  type = "sketch"
  fields = {
    ...SketchDefaults,
    ...HideableDefaults,
    ...HierarchyDefaults
  }
}

const ArcolSketch = SketchMixin(ArcolHierarchyMixin(_ArcolSketch))
type ArcolSketchType = InstanceType<typeof ArcolSketch>

class _ArcolExtrusion extends ArcolElementBase<ExtrusionFields & HideableFields & HierarchyFields<ArcolElementId>> {
  type = "extrusion"
  fields = {
    ...ExtrusionDefaults,
    ...HideableDefaults,
    ...HierarchyDefaults
  }
}

const ArcolExtrusion = ExtrusionMixin(ArcolHierarchyMixin(HideableMixin(_ArcolExtrusion)))
type ArcolExtrusionType = InstanceType<typeof ArcolExtrusion>

class _ArcolGroup extends ArcolElementBase<HierarchyFields<ArcolElementId>> {
  type = "group"
  fields = {
    ...HierarchyDefaults
  }
}

const ArcolGroup = ArcolHierarchyMixin(_ArcolGroup)
type ArcolGroupType = InstanceType<typeof ArcolGroup>

function switchOnType(element: ArcolElementBase<any>,
  callbacks: {
    sketch: (element: ArcolSketchType) => void,
    extrusion: (element: ArcolExtrusionType) => void,
    group: (element: ArcolGroupType) => void
  }
) {
  switch (element.type) {
    case "sketch":
      return callbacks.sketch(element as ArcolSketchType)
    case "extrusion":
      return callbacks.extrusion(element as ArcolExtrusionType)
    case "group":
      return callbacks.group(element as ArcolGroupType)
    default:
      throw new Error(`Unknown element type: ${element.type}`)
  }
}

const sketch = new ArcolSketch('a' as ArcolElementId)
const extrusion = new ArcolExtrusion('b' as ArcolElementId)
const group = new ArcolGroup('c' as ArcolElementId)

extrusion.sketchId = sketch.id
extrusion.height = 10
extrusion.hidden = true

sketch.translate = [1, 2, 3]
sketch.color = '#000'

sketch.parentId = group.id

const children = group.children;
for (const child of children) {
  switchOnType(child, {
    sketch: (element) => {
      console.log(element.translate)
    },
    extrusion: (element) => {
      console.log(element.height)
    },
    group: (element) => {
      console.log(element.children)
    }
  })
}