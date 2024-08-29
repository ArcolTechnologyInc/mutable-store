namespace Z {

  abstract class Base<T> {
    abstract fields: T
  }

  class FooComponent {
    fields: {
      foo: string
    } = {
        foo: "foo"
      }
    constructor(fields: { foo: string }) {
      this.fields = fields
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

  class BarComponent {
    fields: {
      bar: number
    } = {
        bar: 1
      }
    constructor(fields: { bar: number }) {
      this.fields = fields
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

  class _Entity extends Base<{ foo: string, bar: number }> {
    fields: { foo: string; bar: number; };

    fooComponent: FooComponent = new FooComponent(this.fields)
    barComponent: BarComponent = new BarComponent(this.fields)

    constructor(fields: { foo: string, bar: number }) {
      super()
      this.fields = fields
    }
  }

  type Entity =
    FlattenComponents(FlattenComponents(_Entity, "fooComponent", FooComponent), "barComponent", BarComponent)

  type GenericConstructor<T> = new (...args: any[]) => T
  type DefaultConstructor<T> = new () => T

  function FlattenComponents<
    TBase extends GenericConstructor<any>,
    TComponent extends DefaultConstructor<any>
  >(Base: TBase, componentField: string, Component: TComponent)
    : GenericConstructor<
      Omit<InstanceType<TBase>, "constructor">
      & Omit<InstanceType<TComponent>, "constructor">
    > {
    // @ts-ignore
    return class extends Base {
      constructor(...args: any[]) {
        super(...args)
        this[componentField] = new Component()

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

    function NoOpMixin<TBase extends GenericConstructor<any>>(Base: TBase)
      : TBase {
      return class extends Base {
        constructor(...args: any[]) {
          super(...args)
        }
      }
    }

    // const Entity = ComponentMixin(ComponentMixin(class { }, FooComponent), BarComponent)
    // const EntityWithFoo = ComponentMixin(class { }, FooComponent)
    // const EntityWithBar = ComponentMixin(class { }, BarComponent)

    // const EntityWithError = ComponentMixin(
    //   ComponentMixin(class { }, FooComponent),
    //   FooComponent
    // )

    // try {
    //   const errorEntity = new EntityWithError();
    //   throw new Error("should not get here")
    // } catch (e) {
    //   console.log("correct re: duplicate property")
    // }
    // const e = new Entity()
    // console.log("e", e)
    // e.foo = "hello"
    // e.bar = 2
    // //@ts-expect-error
    // e.asdf = 123

    // const e2 = new Entity()
    // console.log(e2)
    // e2.foo = "bye"
    // e2.bar = 4
    // //@ts-expect-error
    // e2.asdf = 123

    // console.log()
    // console.log("e2.foo", e2.foo)
    // console.log("e2.bar", e2.bar)
    // console.log("e2.helloFoo()", e2.helloFoo())
    // console.log("e2.barSquared()", e2.barSquared())
    // console.log("e2.barCubed())", e2.barCubed())

    // console.log()
    // console.log("e.foo", e.foo)
    // console.log("e.bar", e.bar)
    // console.log("e.helloFoo()", e.helloFoo())
    // console.log("e.barSquared()", e.barSquared())
    // console.log("e.barCubed())", e.barCubed())

    // const e3 = new EntityWithFoo()
    // console.log("e3", e3)
    // e3.foo = "hello"
    // console.log("e3.foo", e3.foo)
    // console.log("e3.helloFoo()", e3.helloFoo())
    // //@ts-expect-error
    // console.log("e3.bar", e3.bar, "should be undefined")
    // try {
    //   //@ts-expect-error
    //   console.log("e3.bar", e3.barSquared())
    //   throw new Error("should not get here")
    // } catch (e) {
    //   console.log("correct re: e3.bar")
    // }

    // const e4 = new EntityWithBar()
    // console.log("e4", e4)
    // e4.bar = 2
    // //@ts-expect-error
    // console.log("e4.foo", e4.foo, "should be undefined")
    // console.log("e4.bar", e4.bar)
    // console.log("e4.barSquared()", e4.barSquared())
    // try {
    //   //@ts-expect-error
    //   console.log("e4.helloFoo()", e4.helloFoo())
    //   throw new Error("should not get here")
    // } catch (e) {
    //   console.log("correct re: e4.helloFoo")
    // }
  }