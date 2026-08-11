import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'

export default function QrCameraScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => { controlsRef.current?.stop() }, [])
  const start = async () => {
    setError('')
    try {
      const reader = new BrowserQRCodeReader()
      controlsRef.current = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current!, (result) => {
        if (!result) return
        const value = result.getText()
        try { const parsed = new URL(value); const code = parsed.searchParams.get('code'); if (code) { onCode(code); controlsRef.current?.stop(); setActive(false); return } } catch { /* QR pode conter somente os quatro dígitos */ }
        if (/^\d{4}$/.test(value)) { onCode(value); controlsRef.current?.stop(); setActive(false) }
      })
      setActive(true)
    } catch (reason) {
      setError(reason instanceof Error && reason.name === 'NotAllowedError' ? 'Autorize o acesso à câmera nas configurações do navegador.' : 'Não foi possível abrir a câmera neste celular.')
      setActive(false)
    }
  }
  const stop = () => { controlsRef.current?.stop(); controlsRef.current = null; setActive(false) }
  return <div className="qr-camera"><video ref={videoRef} className={active ? 'qr-video active' : 'qr-video'} muted playsInline /><button className="outline full" onClick={() => active ? stop() : void start()}>{active ? <><CameraOff size={16} /> Fechar câmera</> : <><Camera size={16} /> Ler QR Code com a câmera</>}</button>{error && <small className="error">{error}</small>}</div>
}
