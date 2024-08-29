namespace Z {

  abstract class Base<T> {
    fields: T
    constructor(fields: T) {
      this.fields = fields
    }
  }

  class Foo extends Base<{ foo: string }> {
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

  class Bar extends Base<{ bar: number }> {
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
      return this.barCubedHelper();
    }
    private barCubedHelper() {
      return this.fields.bar * this.fields.bar * this.fields.bar;
    }
  }

  type BaseConstructor<F, T> = new (f: F, ...args: any[]) => T

  function ComponentMixin<
    TBaseFields,
    TBase extends Base<TBaseFields>,
    TComponentFields,
    TComponent extends Base<TComponentFields>
  >(
    Base: BaseConstructor<TBaseFields, TBase>,
    Component: BaseConstructor<TComponentFields, TComponent>
  ): BaseConstructor<
    TBaseFields & TComponentFields,
    Omit<InstanceType<BaseConstructor<TBaseFields, TBase>>, "constructor">
    &
    Omit<InstanceType<BaseConstructor<TComponentFields, TComponent>>, "constructor">
  > {
    //@ts-expect-error
    return class extends Base {
      constructor(f: TBaseFields & TComponentFields, ...args: any[]) {
        super(f, ...args)
        const descriptors = Object.getOwnPropertyDescriptors(Component.prototype);
        for (const key in descriptors) {
          if (key !== "constructor") {
            if (key in this) {
              throw new Error(`Duplicate property: ${key}`)
            }
            Object.defineProperty(this, key, descriptors[key]);
          }
        }
      }
    }
  }

  const Entity = ComponentMixin(ComponentMixin(class extends Base<{}> { }, Foo), Bar)
  const EntityWithFoo = ComponentMixin(class extends Base<{}> { }, Foo)
  const EntityWithBar = ComponentMixin(class extends Base<{}> { }, Bar)

  const EntityWithError = ComponentMixin(
    class extends Base<{}> { },
    Foo
  )

  try {
    const errorEntity = new EntityWithError({foo: "asdf"});
    throw new Error("should not get here")
  } catch (e) {
    console.log("correct re: duplicate property")
  }
  const e = new Entity({foo: "asdf", bar: 123})
  //@ts-expect-error
  console.log("e._foo", e._foo)
  e.foo = "hello"
  e.bar = 2
  //@ts-expect-error
  e.asdf = 123

  const e2 = new Entity({foo: "asdf", bar: 123})
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

  const e3 = new EntityWithFoo({foo: "asdf"})
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

  const e4 = new EntityWithBar({bar: 123})
  console.log("e4", e4)
  e4.bar = 2
  //@ts-expect-error
  console.log("e4.foo", e4.foo, "should be undefined")
  console.log("e4.bar", e4.bar)
  console.log("e4.barSquared()", e4.barSquared())
  try {
    //@ts-expect-error
    console.log("e4.helloFoo()", e4.helloFoo())
    throw new Error("should not get here")
  } catch (e) {
    console.log("correct re: e4.helloFoo")
  }
}