namespace Z {

  abstract class Base<T> {
    fields: T
    constructor(fields: T) {
      this.fields = fields
    }
  }

  class FooComponent extends Base<{ foo: string }> {
    constructor(fields: { foo: string }) {
      super(fields)
    }
    get foo() {
      return this.fields.foo;
    }
    set foo(value: string) {
      this.fields.foo = value;
    }
    helloFoo() {
      return "hello " + this.fields.foo
    }
  }

  class BarComponent extends Base<{ bar: number }> {
    constructor(fields: { bar: number }) {
      super(fields)
    }
    get bar() {
      return this.fields.bar;
    }
    set bar(value: number) {
      this.fields.bar = value;
    }
    barSquared() {
      return this.fields.bar * this.fields.bar;
    }
    barCubed() {
      return this.fields.bar * this.fields.bar * this.fields.bar;
    }
  }

  type BaseConstructor<F, T> = new (f: F, ...args: any[]) => T

  function FlattenComponents<
    TBaseFields,
    TBase extends Base<TBaseFields>,
    TComponentFields,
    TComponent extends Base<TComponentFields>
  >(
    Base: BaseConstructor<TBaseFields, TBase>,
    componentField: string,
    Component: BaseConstructor<TComponentFields, TComponent>
  )
    : BaseConstructor<
      TBaseFields & TComponentFields,
      Omit<InstanceType<BaseConstructor<TBaseFields, TBase>>, "constructor">
      &
      Omit<InstanceType<BaseConstructor<TComponentFields, TComponent>>, "constructor">
      &
      Base<TBaseFields & TComponentFields>
    > {
    // @ts-ignore
    return class extends Base {
      constructor(fields: TBaseFields & TComponentFields, ...args: any[]) {
        super(fields, ...args)

        // @ts-ignore
        const component = this[componentField] as TComponent

        const descriptors = Object.getOwnPropertyDescriptors(Component.prototype);
        for (const key in descriptors) {
          if (key !== "constructor") {
            if (key in this) {
              throw new Error(`Duplicate property: ${key}`)
            }
            const newDescriptor = { ...descriptors[key] }
            if (newDescriptor.value instanceof Function) {
              newDescriptor.value = newDescriptor.value.bind(component)
            }
            if (newDescriptor.get) {
              newDescriptor.get = newDescriptor.get.bind(component)
            }
            if (newDescriptor.set) {
              newDescriptor.set = newDescriptor.set.bind(component)
            }
            Object.defineProperty(this, key, newDescriptor)
          }
        }
      }
    }
  }

  class _Entity extends Base<{ foo: string, bar: number }> {
    fooComponent: FooComponent = new FooComponent(this.fields)
    barComponent: BarComponent = new BarComponent(this.fields)

    constructor(fields: { foo: string, bar: number }) {
      super(fields)
    }
  }

  const Entity =
    FlattenComponents(FlattenComponents(
      _Entity, "fooComponent", FooComponent), "barComponent", BarComponent)

  const EntityWithError =
    FlattenComponents(FlattenComponents(
      class _Entity extends Base<{ foo: string }> {
        fooComponent: FooComponent = new FooComponent(this.fields)
        constructor(fields: { foo: string }) {
          super(fields)
        }
      }, "fooComponent", FooComponent), "fooComponent", FooComponent)


  const EntityWithFoo =
    FlattenComponents(
      class _Entity extends Base<{ foo: string }> {
        fooComponent: FooComponent = new FooComponent(this.fields)
        constructor(fields: { foo: string }) {
          super(fields)
        }
      }, "fooComponent", FooComponent)

  try {
    const errorEntity = new EntityWithError({ foo: "hello" });
    throw new Error("should not get here")
  } catch (e) {
    console.log("correct re: duplicate property")
  }

  const e = new Entity({ foo: "asdf", bar: 2 })
  console.log("e", e)
  e.fooComponent.foo = "hello1"
  console.log("e.fooComponent.foo", e.fooComponent.foo)
  e.foo = "hello"
  e.bar = 2
  //@ts-expect-error
  e.asdf = 123

  const e2 = new Entity({ foo: "asdf", bar: 4 })
  console.log(e2)
  e2.foo = "bye"
  e2.bar = 4
  //@ts-expect-error
  e2.asdf = 123

  console.log()
  console.log("e2.foo", e2.foo)
  console.log("e2.bar", e2.bar)
  console.log("e2.helloFoo()", e2.helloFoo())
  console.log("e2.barSquared()", e2.barSquared())
  console.log("e2.barCubed())", e2.barCubed())

  console.log()
  console.log("e.foo", e.foo)
  console.log("e.bar", e.bar)
  console.log("e.helloFoo()", e.helloFoo())
  console.log("e.barSquared()", e.barSquared())
  console.log("e.barCubed())", e.barCubed())

  const e3 = new EntityWithFoo({ foo: "asdf" })
  console.log("e3", e3)
  e3.foo = "hello"
  console.log("e3.foo", e3.foo)
  console.log("e3.helloFoo()", e3.helloFoo())
  //@ts-expect-error
  console.log("e3.bar", e3.bar, "should be undefined")
  try {
    //@ts-expect-error
    console.log("e3.bar", e3.barSquared())
    throw new Error("should not get here")
  } catch (e) {
    console.log("correct re: e3.bar")
  }
}