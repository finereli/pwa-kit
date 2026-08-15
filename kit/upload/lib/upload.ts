// Uploads with real progress, and a small queue that runs a per-file
// pipeline with bounded concurrency, cancel, retry and a close-tab guard.
//
// fetch() gives no upload progress, so the upload itself is XHR. Everything
// after the bytes land (create record, process, generate metadata) is the
// app's pipeline function; the queue only owns the job list and its states.
//
//   import { UploadQueue, uploadWithProgress } from '$shared/lib/upload'
//   export const uploadQueue = new UploadQueue({
//     accept: ['m4a', 'wav', 'mp4'],
//     maxConcurrent: 3,
//     async run(job, { setStep, setProgress }) {
//       // A retried job that already created its record resumes after upload.
//       if (!job.recordId) {
//         job.phase = 'upload'                       // cancelable while here
//         const key = crypto.randomUUID()
//         await uploadWithProgress({
//           url: `/api/upload/${key}`, file: job.file, token: auth.token,
//           onStart: (xhr) => (job.xhr = xhr),
//           onProgress: (p) => setProgress(Math.round(p * 55)),
//           onUnauthorized: () => auth.handleUnauthorized(),
//         }).finally(() => (job.xhr = null))
//         job.phase = 'process'
//         job.recordId = (await createRecord(key, job)).id
//       }
//       setStep('Generating title...'); setProgress(75)
//       await generateMetadata(job.recordId)
//     },
//   })
//
// Job fields: key, file, fileName, baseName (extension stripped, underscores
// to spaces - a decent default title), status queued|running|done|error,
// phase ('upload' while the XHR is in flight, else 'process'), step (text),
// progress 0..100, error, recordId, canceled, xhr, plus anything `meta` you
// pass to enqueue(files, meta).
//
// Rules baked in: cancel is only possible while queued or uploading - once
// the record exists the remaining steps run to completion (retry resumes
// after upload); a beforeunload guard warns while anything is active; SPA
// navigation is safe because the queue is a module-level store.

export interface UploadArgs {
  url: string
  file: Blob
  token?: string
  contentType?: string
  method?: string
  onProgress?: (fraction: number) => void
  onStart?: (xhr: XMLHttpRequest) => void
  onUnauthorized?: () => void
}

export function uploadWithProgress({ url, file, token, contentType, method = 'POST', onProgress, onStart, onUnauthorized }: UploadArgs): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    onStart?.(xhr)
    xhr.open(method, url)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', contentType || (file as File).type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onabort = () => reject(new Error('canceled'))
    xhr.onload = () => {
      if (xhr.status === 401) onUnauthorized?.()
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr)
      else reject(new Error(`Upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Upload failed: network error'))
    xhr.send(file)
  })
}

export function cleanBaseName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type JobStatus = 'queued' | 'running' | 'done' | 'error'

export interface UploadJob {
  key: string
  file: File
  fileName: string
  baseName: string
  ext: string
  status: JobStatus
  phase: '' | 'upload' | 'process'
  step: string
  progress: number
  error: string | null
  recordId: string | null
  canceled: boolean
  xhr: XMLHttpRequest | null
  [key: string]: unknown
}

export interface JobHelpers {
  setStep: (s: string) => void
  setProgress: (p: number) => void
}

export interface UploadQueueOptions {
  run: (job: UploadJob, helpers: JobHelpers) => Promise<void>
  accept?: string[] | null
  maxConcurrent?: number
  errorText?: { upload: string; process: string }
}

export class UploadQueue {
  jobs = $state<UploadJob[]>([])
  #active = 0
  #opts: Required<UploadQueueOptions>

  constructor({ run, accept = null, maxConcurrent = 3, errorText = { upload: 'Upload failed', process: 'Processing failed' } }: UploadQueueOptions) {
    if (!run) throw new Error('UploadQueue: run(job, helpers) is required')
    this.#opts = { run, accept, maxConcurrent, errorText }
    addEventListener('beforeunload', (e) => {
      if (this.hasActive()) {
        e.preventDefault()
        e.returnValue = ''
      }
    })
  }

  hasActive() {
    return this.jobs.some((j) => j.status === 'queued' || j.status === 'running')
  }

  isCancelable(job: UploadJob) {
    return job.status === 'queued' || (job.status === 'running' && job.phase === 'upload')
  }

  enqueue(files: Iterable<File>, meta: Record<string, unknown> = {}) {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase()
      if (this.#opts.accept && !this.#opts.accept.includes(ext)) continue
      const baseName = cleanBaseName(file.name)
      this.jobs.push({
        key: crypto.randomUUID(),
        file,
        fileName: file.name,
        baseName,
        ext,
        status: 'queued',
        phase: '',
        step: '',
        progress: 0,
        error: null,
        recordId: null,
        canceled: false,
        xhr: null,
        ...meta,
      })
    }
    this.#pump()
  }

  retry(key: string) {
    const job = this.jobs.find((j) => j.key === key)
    if (!job || job.status !== 'error') return
    job.status = 'queued'
    job.error = null
    this.#pump()
  }

  dismiss(key: string) {
    this.jobs = this.jobs.filter((j) => j.key !== key)
  }

  cancel(key: string) {
    const job = this.jobs.find((j) => j.key === key)
    if (!job) return
    if (job.status === 'queued') {
      this.dismiss(key)
    } else if (job.status === 'running' && job.xhr) {
      job.canceled = true
      job.xhr.abort()
    }
  }

  cancelAll(filter: (j: UploadJob) => boolean = () => true) {
    for (const job of this.jobs.filter(filter)) this.cancel(job.key)
  }

  clearFinished(filter: (j: UploadJob) => boolean = () => true) {
    this.jobs = this.jobs.filter((j) => !filter(j) || (j.status !== 'done' && j.status !== 'error'))
  }

  #pump() {
    while (this.#active < this.#opts.maxConcurrent) {
      const next = this.jobs.find((j) => j.status === 'queued')
      if (!next) break
      this.#active++
      this.#run(next)
    }
  }

  async #run(job: UploadJob) {
    job.status = 'running'
    job.error = null
    const helpers: JobHelpers = {
      setStep: (s) => (job.step = s),
      setProgress: (p) => (job.progress = Math.max(job.progress, p)),
    }
    try {
      await this.#opts.run(job, helpers)
      job.progress = 100
      job.status = 'done'
      job.step = ''
    } catch (err) {
      if (job.canceled) {
        this.dismiss(job.key)
      } else {
        console.error('Upload pipeline failed:', err)
        job.status = 'error'
        job.error = job.recordId ? this.#opts.errorText.process : this.#opts.errorText.upload
        job.step = ''
      }
    } finally {
      job.phase = ''
      this.#active--
      this.#pump()
    }
  }
}
