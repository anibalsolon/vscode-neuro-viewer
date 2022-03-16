declare module 'nyc' {
  export default class NYC {
    constructor(options: Record<string, unknown>);
    createTempDirectory(): Promise<void>
    writeCoverageFile(): Promise<void>
    reset(): Promise<void>
    wrap(): Promise<void>
  }
}