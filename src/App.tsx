import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import QRCode from 'qrcode'

type ExtraField = {
  id: number
  label: string
  value: string
}

type DetailRow = {
  label: string
  value: string
}

const createExtraField = (id: number): ExtraField => ({
  id,
  label: '',
  value: '',
})

const buildDetailRows = (
  form: {
    name: string
    designation: string
    email: string
    location: string
    phone: string
    notes: string
  },
  extraFields: ExtraField[],
) => {
  const rows: DetailRow[] = [
    { label: 'Name', value: form.name.trim() },
    { label: 'Designation', value: form.designation.trim() },
    { label: 'Email', value: form.email.trim() },
    { label: 'Phone', value: form.phone.trim() },
    { label: 'Location', value: form.location.trim() },
    { label: 'Notes', value: form.notes.trim() },
  ]

  const customRows = extraFields
    .map((field) => ({
      label: field.label.trim() || 'Custom',
      value: field.value.trim(),
    }))
    .filter((field) => field.value.length > 0)

  return [...rows, ...customRows].filter((row) => row.value.length > 0)
}

const buildReadablePayload = (rows: DetailRow[]) => {
  if (rows.length === 0) {
    return 'Fill in the form to generate your QR code.'
  }

  return [
    'CONTACT DETAILS',
    '----------------',
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ].join('\n')
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image.'))
    image.src = src
  })

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

const wrapLine = (text: string, maxChars: number) => {
  const words = text.split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (candidate.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines.length > 0 ? lines : ['']
}

const createDetailsImage = (detailRows: DetailRow[]) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    return ''
  }

  const bodyLines = detailRows.flatMap((row) => wrapLine(`${row.label}: ${row.value}`, 52))
  const safeLines = bodyLines.length > 0 ? bodyLines : ['No details entered yet.']
  const width = 1080
  const padding = 76
  const headerHeight = 200
  const lineHeight = 54
  const footerHeight = 88
  const height = headerHeight + safeLines.length * lineHeight + footerHeight

  canvas.width = width
  canvas.height = height

  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#111827')
  gradient.addColorStop(1, '#1d4ed8')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  context.fillStyle = 'rgba(255,255,255,0.12)'
  context.fillRect(padding - 24, 32, width - padding * 2 + 48, height - 64)

  context.fillStyle = '#f8fafc'
  context.font = '700 62px Trebuchet MS, Segoe UI, sans-serif'
  context.fillText('Shared Contact Details', padding, 112)

  context.fillStyle = 'rgba(248, 250, 252, 0.9)'
  context.font = '400 34px Trebuchet MS, Segoe UI, sans-serif'
  context.fillText('Scan source: QR-Gen', padding, 164)

  context.font = '500 36px Trebuchet MS, Segoe UI, sans-serif'
  safeLines.forEach((line, index) => {
    context.fillText(line, padding, headerHeight + lineHeight * (index + 0.5))
  })

  context.font = '400 30px Trebuchet MS, Segoe UI, sans-serif'
  context.fillText('Generated with QR-Gen', padding, height - 36)

  return canvas.toDataURL('image/png')
}

function App() {
  const [form, setForm] = useState({
    name: '',
    designation: '',
    email: '',
    location: '',
    phone: '',
    notes: '',
  })
  const [extraFields, setExtraFields] = useState<ExtraField[]>([
    createExtraField(1),
  ])
  const nextExtraFieldId = useRef(2)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const detailRows = useMemo(() => buildDetailRows(form, extraFields), [form, extraFields])
  const payload = useMemo(() => buildReadablePayload(detailRows), [detailRows])

  const [qrBaseImage, setQrBaseImage] = useState('')
  const [qrImage, setQrImage] = useState('')
  const [logoImage, setLogoImage] = useState('')
  const detailsImage = useMemo(() => createDetailsImage(detailRows), [detailRows])

  const updateField = (
    key: keyof typeof form,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const updateExtraField = (
    id: number,
    key: keyof ExtraField,
    value: string,
  ) => {
    setExtraFields((current) =>
      current.map((field) =>
        field.id === id
          ? {
              ...field,
              [key]: value,
            }
          : field,
      ),
    )
  }

  const addExtraField = () => {
    setExtraFields((current) => [
      ...current,
      createExtraField(nextExtraFieldId.current++),
    ])
  }

  const removeExtraField = (id: number) => {
    setExtraFields((current) =>
      current.length === 1 ? current : current.filter((field) => field.id !== id),
    )
  }

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      setLogoImage('')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoImage(reader.result)
      }
    }

    reader.readAsDataURL(file)
  }

  const clearLogo = () => {
    setLogoImage('')

    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  useEffect(() => {
    let active = true

    const renderQrCode = async () => {
      try {
        const imageUrl = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 320,
          color: {
            dark: '#0b1020',
            light: '#ffffff',
          },
        })

        if (active) {
          setQrBaseImage(imageUrl)
        }
      } catch {
        if (active) {
          setQrBaseImage('')
          setQrImage('')
        }
      }
    }

    void renderQrCode()

    return () => {
      active = false
    }
  }, [payload])

  useEffect(() => {
    let active = true

    const composeQrImage = async () => {
      if (!qrBaseImage) {
        setQrImage('')
        return
      }

      if (!logoImage) {
        setQrImage(qrBaseImage)
        return
      }

      try {
        const [qr, logo] = await Promise.all([loadImage(qrBaseImage), loadImage(logoImage)])
        const canvas = document.createElement('canvas')
        canvas.width = qr.width
        canvas.height = qr.height

        const context = canvas.getContext('2d')

        if (!context) {
          setQrImage(qrBaseImage)
          return
        }

        context.drawImage(qr, 0, 0)

        const logoSize = Math.floor(canvas.width * 0.24)
        const logoX = Math.floor((canvas.width - logoSize) / 2)
        const logoY = Math.floor((canvas.height - logoSize) / 2)
        const padding = Math.floor(logoSize * 0.12)
        const radius = Math.floor(logoSize * 0.2)

        context.fillStyle = '#ffffff'
        context.beginPath()
        context.moveTo(logoX + radius, logoY)
        context.lineTo(logoX + logoSize - radius, logoY)
        context.quadraticCurveTo(logoX + logoSize, logoY, logoX + logoSize, logoY + radius)
        context.lineTo(logoX + logoSize, logoY + logoSize - radius)
        context.quadraticCurveTo(
          logoX + logoSize,
          logoY + logoSize,
          logoX + logoSize - radius,
          logoY + logoSize,
        )
        context.lineTo(logoX + radius, logoY + logoSize)
        context.quadraticCurveTo(logoX, logoY + logoSize, logoX, logoY + logoSize - radius)
        context.lineTo(logoX, logoY + radius)
        context.quadraticCurveTo(logoX, logoY, logoX + radius, logoY)
        context.closePath()
        context.fill()

        context.drawImage(
          logo,
          logoX + padding,
          logoY + padding,
          logoSize - padding * 2,
          logoSize - padding * 2,
        )

        if (active) {
          setQrImage(canvas.toDataURL('image/png'))
        }
      } catch {
        if (active) {
          setQrImage(qrBaseImage)
        }
      }
    }

    void composeQrImage()

    return () => {
      active = false
    }
  }, [logoImage, qrBaseImage])

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_8%_5%,rgba(249,115,22,0.15),transparent_38%),radial-gradient(circle_at_92%_2%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,#020617,#111827)] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <section className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-md">
          <p className="inline-flex rounded-full border border-orange-300/40 bg-orange-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-100">
            QR profile generator
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Share readable details in one scan
          </h1>
          <p className="mt-3 max-w-3xl text-base text-slate-200/90">
            This QR now encodes plain readable text instead of vCard. Scanners will show
            clean lines like Name, Email, Phone, Location, and your custom fields.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form className="min-w-0 space-y-5 rounded-3xl border border-white/15 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/50 backdrop-blur md:p-6">
            <header>
              <h2 className="text-2xl font-bold text-white">Profile details</h2>
              <p className="mt-1 text-sm text-slate-300">Add the information you want people to see after scanning.</p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-200">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-200">
                <span>Designation</span>
                <input
                  value={form.designation}
                  onChange={(event) => updateField('designation', event.target.value)}
                  placeholder="Product Designer"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-200">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-200">
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium text-slate-200">
              <span>Location</span>
              <input
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                placeholder="Chennai, India"
                className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-200">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Add any other details you want to share"
                rows={4}
                className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
              />
            </label>

            <div className="rounded-2xl border border-cyan-200/30 bg-cyan-400/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">QR logo</h3>
                {logoImage ? (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>

              <label className="group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-cyan-100/40 bg-slate-900/50 px-4 py-3 transition hover:border-cyan-100/70 hover:bg-slate-900/70">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                {logoImage ? (
                  <img src={logoImage} alt="Logo preview" className="h-12 w-12 rounded-xl border border-white/15 bg-white object-contain p-1" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/20 bg-slate-800 text-lg text-cyan-100">+</div>
                )}
                <span className="text-sm text-slate-200">
                  {logoImage ? 'Change QR center logo' : 'Upload logo image (PNG/JPG)'}
                </span>
              </label>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Custom fields</h3>
                  <p className="text-sm text-slate-300">Add extra details if needed.</p>
                </div>
                <button
                  type="button"
                  onClick={addExtraField}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-cyan-400 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
                >
                  Add field
                </button>
              </div>

              <div className="space-y-3">
                {extraFields.map((field) => (
                  <div key={field.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end">
                    <label className="space-y-2 text-sm text-slate-200">
                      <span>Field name</span>
                      <input
                        value={field.label}
                        onChange={(event) => updateExtraField(field.id, 'label', event.target.value)}
                        placeholder="Company"
                        className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-200">
                      <span>Field value</span>
                      <input
                        value={field.value}
                        onChange={(event) => updateExtraField(field.id, 'value', event.target.value)}
                        placeholder="Acme Studio"
                        className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none ring-orange-300/40 transition focus:ring-2"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeExtraField(field.id)}
                      className="rounded-xl border border-white/20 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </form>

          <aside className="min-w-0 space-y-4 rounded-3xl border border-white/15 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/50 backdrop-blur md:p-6">
            <header>
              <h2 className="text-2xl font-bold text-white">Live QR preview</h2>
              <p className="mt-1 text-sm text-slate-300">Scanning shows readable text lines, not vCard.</p>
            </header>

            <div className="mx-auto w-full max-w-xs rounded-3xl border border-white/15 bg-white/10 p-4">
              {qrImage ? (
                <img src={qrImage} alt="Generated QR code" className="w-full rounded-2xl bg-white p-2" />
              ) : (
                <div className="grid min-h-60 place-items-center rounded-2xl bg-slate-900/50 px-4 text-center text-sm text-slate-300">
                  QR preview will appear here.
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!qrImage}
                onClick={() => downloadDataUrl(qrImage, 'contact-qr.png')}
                className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Download QR
              </button>
              <button
                type="button"
                disabled={!detailsImage}
                onClick={() => downloadDataUrl(detailsImage, 'contact-details.png')}
                className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Download details image
              </button>
            </div>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Encoded text</h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-sm leading-relaxed text-slate-200">{payload}</pre>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Generated details image</h3>
              {detailsImage ? (
                <img src={detailsImage} alt="Details card" className="w-full rounded-2xl border border-white/15" />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-6 text-center text-sm text-slate-300">
                  Details image preview will appear here.
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}

export default App
