class Alerts {
  alert() {}
}
abstract class Cloneable {
  abstract clone(): this;
}

function traits<A, B>(a: A, b: B) {
  return class {
    $traits = new Set([a, b]);
    extends<T>(t: T) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this.$traits.has(t as any);
    }
  };
}

class A extends traits(Alerts, Cloneable) {}

const a = new A();
console.log(a);
