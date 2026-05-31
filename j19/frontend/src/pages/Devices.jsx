import DeviceList from '../components/DeviceManager/DeviceList.jsx'
import DeviceConnection from '../components/DeviceManager/DeviceConnection.jsx'

export default function Devices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Devices</h1>
        <p className="text-slate-400 mt-1">Manage your FPGA device connections</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DeviceList />
        </div>
        <div className="lg:col-span-1">
          <DeviceConnection />
        </div>
      </div>
    </div>
  )
}
