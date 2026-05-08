import { Activity } from 'lucide-react'

export default function LoadingState({ message }) {
  return (
    <div className="min-h-screen bg-hmi-dark text-white flex items-center justify-center">
      <div className="text-center">
        <Activity className="w-12 h-12 text-hmi-info mx-auto mb-4 animate-spin" />
        <h2 className="text-xl font-semibold mb-2">NextGen-HMI</h2>
        <p className="text-gray-400">{message || 'Loading...'}</p>
      </div>
    </div>
  )
}
