// I'm surprised JavaScript doesn't have one of these built in already!? 
/**
 * Mutex to allow only one (async) process to proceed at a time.
 */
export class Mutex {
    private _locked = false
    private queue: (() => Promise<void>)[] = []
    private setLocked(locked: boolean) {
        this._locked = locked
        if (this.lockNotifier) this.lockNotifier(locked)
    }

    get locked(): boolean { return this._locked }

    // Can be set to a callback that gets called when .locked changes.
    lockNotifier: ((locked: boolean) => void)|undefined
    
    /** 
     * Run a single callback with the locked mutex.
     * 
     * Will wait until a lock is available.
     */
    run<T>(callback: () => Promise<T>): Promise<T> {
        let res: (value: T) => void
        let rej: (reason?: any) => void
        let promise = new Promise<T>((resolve, reject) => {
            res = resolve
            rej = reject
        })

        let myCallback = async () => {
            try {
                res(await callback())
            } catch (e) {
                rej(e)
            }
        }

        this.queue.push(myCallback)
        this.runQueue() // note: NO await

        return promise
    }

    /**
     * Only run this task if none is already running.
     * 
     * @returns `null` if the Mutex was already locked.
     */
    runIfNone<T>(callback: () => Promise<T>): Promise<T>|null {
        if (this.locked) return null
        else return this.run(callback)
    }

    private async runQueue() {
        // already running:
        if (this.locked) return
        // Nothing to do:
        if (this.queue.length === 0) return

        this.setLocked(true)
        try {
            while (this.queue.length > 0) {
                let callback = this.queue.shift()!
                try {
                    await callback()
                } catch (_ignored) {
                    // Presumably, whatever else is waiting on this Promise
                    // will get the exception when they `await` it.
                    // No need for duplicate throw here.
                    // We have already waited for it to "complete".
                }
            }
        } catch (e) {
            console.error("Exception in Mutex.runQueue()!?  Should be impossible.", e)
        } finally {
            this.setLocked(false)
        }
    }
}