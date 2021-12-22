type EventType = string;
type EventArgs = object;
type EventCallback<T> = (data: T) => void;

export class EventEmitter<E extends EventType, A extends EventArgs> {
  callbacks: {
    [key in E]?: EventCallback<A>[]
  };

  constructor() {
    this.callbacks = {};
  }

  on(event: E, callback: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event]?.push(callback);
  }

  dispatch(event: E, data: A) {
    this.callbacks[event]?.forEach(cb => {
      cb(data);
    });
  }
}