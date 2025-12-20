/**
 * Lazy Service Loader
 *
 * Provides lazy initialization of heavy services to improve startup time.
 * Services are only instantiated when first accessed.
 *
 * Performance optimization: Reduces initial startup time by deferring
 * initialization of non-critical services.
 */

type LazyService<T> = {
  get: () => T
  isInitialized: () => boolean
}

type AsyncLazyService<T> = {
  get: () => Promise<T>
  isInitialized: () => boolean
}

/**
 * Create a lazy-loaded synchronous service
 */
export function createLazyService<T>(factory: () => T): LazyService<T> {
  let instance: T | null = null
  let initialized = false

  return {
    get: () => {
      if (!initialized) {
        instance = factory()
        initialized = true
      }
      return instance as T
    },
    isInitialized: () => initialized,
  }
}

/**
 * Create a lazy-loaded async service
 */
export function createAsyncLazyService<T>(
  factory: () => Promise<T>
): AsyncLazyService<T> {
  let instance: T | null = null
  let initialized = false
  let initPromise: Promise<T> | null = null

  return {
    get: async () => {
      if (initialized) {
        return instance as T
      }

      if (!initPromise) {
        initPromise = factory().then(result => {
          instance = result
          initialized = true
          return result
        })
      }

      return initPromise
    },
    isInitialized: () => initialized,
  }
}

/**
 * ServiceRegistry for managing lazy-loaded services
 * Allows for dependency injection and deferred initialization
 */
export class ServiceRegistry {
  private services = new Map<string, LazyService<unknown> | AsyncLazyService<unknown>>()

  register<T>(name: string, service: LazyService<T> | AsyncLazyService<T>): void {
    this.services.set(name, service)
  }

  get<T>(name: string): T | undefined {
    const service = this.services.get(name)
    if (!service) return undefined
    return (service as LazyService<T>).get()
  }

  async getAsync<T>(name: string): Promise<T | undefined> {
    const service = this.services.get(name)
    if (!service) return undefined
    return (service as AsyncLazyService<T>).get()
  }

  isInitialized(name: string): boolean {
    const service = this.services.get(name)
    return service?.isInitialized() ?? false
  }
}

export const serviceRegistry = new ServiceRegistry()
