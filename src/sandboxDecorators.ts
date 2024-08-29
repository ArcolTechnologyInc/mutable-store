class FooComponent {
  private _foo: string = "foo";
  get foo() {
    return this._foo;
  }
  set foo(value: string) {
    this._foo = value;
  }
}

class BarComponent {
  private _bar: number = 1;
  get bar() {
    return this._bar;
  }
  set bar(value: number) {
    this._bar = value;
  }
  barSquared() {
    return this._bar * this._bar;
  }
  barCubed() {
    return this._bar * this._bar * this._bar;
  }
}

function Component(component: any) {
  return function (target: any) {
    const descriptors = Object.getOwnPropertyDescriptors(component.prototype);
    for (const key in descriptors) {
      if (key !== "constructor") {
        Object.defineProperty(target.prototype, key, descriptors[key]);
      }
    }
  };
}

@Component(FooComponent)
@Component(BarComponent)
class _Entity {
  constructor() { }
}

type DefaultConstructor<T> = new () => T

const Entity = _Entity as unknown as DefaultConstructor<_Entity & Omit<BarComponent, "constructor"> & Omit<FooComponent, "constructor">>

const e = new Entity()
console.log(e)
e.foo = "hello"
e.bar = 2
//@ts-expect-error
e.asdf = 123

const e2 = new Entity()
console.log(e2)
e2.foo = "bye"
e2.bar = 4
console.log("e2.foo", e2.foo)
console.log("e2.bar", e2.bar)
console.log("e2.barSquared()", e2.barSquared())
console.log("e2.barCubed())", e2.barCubed())

console.log("e.foo", e.foo)
console.log("e.bar", e.bar)
console.log("e.barSquared()", e.barSquared())
console.log("e.barCubed())", e.barCubed())
