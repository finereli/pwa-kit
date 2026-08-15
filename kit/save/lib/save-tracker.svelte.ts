// Tracks the state of autosave writes so the UI can show live feedback
// (ui/SaveStatus.svelte) instead of relying on an explicit save button.
// One tracker per editing surface; pass save work through run().
//
// The save model this implements (reference/behavior.md, "Save model"):
// autosave-first, the server is the draft store (no localStorage layer - it
// would be a third state nobody can see), explicit buttons only for creation
// and publication, and a done-button on an autosaving editor is labeled
// "Done", never "Save". Init form fields once per entity id, or a slow
// round-trip clobbers what the user typed next.
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export class SaveTracker {
  status = $state<SaveStatus>('idle')
  #pending = 0
  #lastFn: (() => Promise<unknown>) | null = null

  // Run one save. Overlapping runs are counted so the status only settles
  // to 'saved' when the last in-flight write lands.
  async run(fn: () => Promise<unknown>) {
    this.#lastFn = fn
    this.#pending++
    this.status = 'saving'
    try {
      await fn()
      this.#pending--
      if (this.#pending === 0 && this.status === 'saving') this.status = 'saved'
    } catch (err) {
      this.#pending--
      this.status = 'error'
      console.error('Save failed:', err)
    }
  }

  retry() {
    if (this.#lastFn) this.run(this.#lastFn)
  }

  // Back to the idle hint when the editor switches to another entity.
  reset() {
    this.#pending = 0
    this.#lastFn = null
    this.status = 'idle'
  }
}
