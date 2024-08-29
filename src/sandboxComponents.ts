import { Brand } from "./fileFormat";
import { Vec3 } from "./projectTypes";

abstract class ElementBase<TID, TFields> {
  id: TID
  abstract fields: TFields
  constructor(id: TID) {
    this.id = id;
  }
}

abstract class ArcolElementBase<TFields> extends ElementBase<ArcolElementId, TFields> { }
type ArcolElement = ArcolSketch | ArcolExtrusion
type ArcolElementId = Brand<string, "arcol-element-id">

//////////////////////////////////////////////////////////////////////////////////////////
// Components

type HierarchyFields<TID> = {
  parentId: TID | null
  parentIndex: string
}

type ArcolHierarchyFields = HierarchyFields<ArcolElementId>

const ArcolHierarchyDefaults: ArcolHierarchyFields = {
  parentId: null,
  parentIndex: ""
}

class HierarchyComponent<TID, TElement extends ElementBase<TID, any>> {
  private _childrenSet = new Set<TID>();
  private _cachedChildren: TElement[] | null = null;
  private _fields: HierarchyFields<TID>;
  constructor(fields: HierarchyFields<TID>) {
    this._fields = fields;
  }
}

class ArcolHierarchyComponent extends HierarchyComponent<ArcolElementId, ArcolElement> { }

interface IArcolHierarchyElement {
  hierarchy: ArcolHierarchyComponent
}

type HideableFields = {
  hidden: boolean
}

const HideableDefaults: HideableFields = {
  hidden: false
}

class HideableComponent {
  _fields: HideableFields;
  constructor(fields: HideableFields) {
    this._fields = fields;
  }
  get hidden() {
    return this._fields.hidden;
  }
  set hidden(value: boolean) {
    this._fields.hidden = value;
  }
}

interface IHideableElement {
  hideable: HideableComponent
}

type SketchFields = {
  translate: Vec3
  color: `#${string}`
}

const SketchDefaults: SketchFields = {
  translate: [0, 0, 0],
  color: "#aaa"
}

class SketchComponent {
  _fields: SketchFields;
  constructor(fields: SketchFields) {
    this._fields = fields;
  }

  get translate() {
    return this._fields.translate;
  }
  set translate(value: Vec3) {
    this._fields.translate = value;
  }

  get color() {
    return this._fields.color;
  }
  set color(value: `#${string}`) {
    this._fields.color = value;
  }
}

interface ISketchElement {
  sketch: SketchComponent
}

type ExtrusionFields = {
  height: number
  sketchId: string | null
}

const ExtrusionDefaults: ExtrusionFields = {
  height: 0,
  sketchId: null
}

class ExtrusionComponent {
  _fields: ExtrusionFields;
  constructor(fields: ExtrusionFields) {
    this._fields = fields;
  }

  get height() {
    return this._fields.height;
  }
  set height(value: number) {
    this._fields.height = value;
  }

  get sketchId() {
    return this._fields.sketchId;
  }
  set sketchId(value: string | null) {
    this._fields.sketchId = value;
  }
}

interface IExtrusionElement {
  extrusion: ExtrusionComponent
}

//////////////////////////////////////////////////////////////////////////////////////////
// Elements

class ArcolSketch extends ArcolElementBase<
  SketchFields & HideableFields & ArcolHierarchyFields
> implements IHideableElement, ISketchElement, IArcolHierarchyElement {
  fields = {
    ...SketchDefaults,
    ...HideableDefaults,
    ...ArcolHierarchyDefaults
  }
  hideable = new HideableComponent(this.fields);
  sketch = new SketchComponent(this.fields);
  hierarchy = new ArcolHierarchyComponent(this.fields);
}

class ArcolExtrusion extends ArcolElementBase<
  ExtrusionFields & HideableFields & ArcolHierarchyFields
> implements IHideableElement, IExtrusionElement, IArcolHierarchyElement {
  fields = {
    ...ExtrusionDefaults,
    ...HideableDefaults,
    ...ArcolHierarchyDefaults
  }
  hideable = new HideableComponent(this.fields);
  extrusion = new ExtrusionComponent(this.fields);
  hierarchy = new ArcolHierarchyComponent(this.fields);
}

const sketch = new ArcolSketch('a' as ArcolElementId)
const extrusion = new ArcolExtrusion('b' as ArcolElementId)

extrusion.extrusion.sketchId = sketch.id
extrusion.extrusion.height = 10
extrusion.hideable.hidden = true

sketch.sketch.translate = [1, 2, 3]
sketch.sketch.color = '#000'
sketch.hideable.hidden = true
