import { Modal } from '@/components/ui/Modal';

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  gender?: 'men' | 'kids' | string;
}

const MEN_SIZE_CHART = [
  { brandSize: 'S', standardSize: 'S', chest: '38.5', shoulder: '16.8', length: '28.9' },
  { brandSize: 'M', standardSize: 'M', chest: '40.8', shoulder: '17.5', length: '29.5' },
  { brandSize: 'L', standardSize: 'L', chest: '43', shoulder: '18.2', length: '30.1' },
  { brandSize: 'XL', standardSize: 'XL', chest: '45.2', shoulder: '19', length: '30.8' },
  { brandSize: 'XXL', standardSize: 'XXL', chest: '47.5', shoulder: '19.8', length: '31.4' },
];

const KIDS_SIZE_CHART = [
  { brandSize: '2-3Y', standardSize: '2-3Y', chest: '22', shoulder: '10.2', length: '15.5' },
  { brandSize: '4-5Y', standardSize: '4-5Y', chest: '24', shoulder: '11.0', length: '17.5' },
  { brandSize: '6-7Y', standardSize: '6-7Y', chest: '26', shoulder: '11.8', length: '19.5' },
  { brandSize: '8-9Y', standardSize: '8-9Y', chest: '28', shoulder: '12.5', length: '21.5' },
  { brandSize: '10-11Y', standardSize: '10-11Y', chest: '30', shoulder: '13.2', length: '23.5' },
  { brandSize: '12-13Y', standardSize: '12-13Y', chest: '32', shoulder: '14.0', length: '25.5' },
];

export function SizeChartModal({ isOpen, onClose, gender = 'men' }: SizeChartModalProps) {
  const isKids = gender === 'kids';
  const rows = isKids ? KIDS_SIZE_CHART : MEN_SIZE_CHART;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Size Chart" className="max-w-xl">
      <div className="space-y-4 pt-1">
        <p className="text-sm font-semibold text-primary-900 dark:text-white">IN Regular</p>

        <div className="overflow-x-auto rounded-2xl border border-primary-200 dark:border-primary-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-primary-200 bg-primary-50/70 text-primary-900 dark:border-primary-700 dark:bg-primary-800/60 dark:text-white">
              <tr>
                <th className="px-4 py-3.5 font-bold">Brand Size</th>
                <th className="px-4 py-3.5 font-bold">Standard Size</th>
                <th className="px-4 py-3.5 font-bold">Chest (in)</th>
                <th className="px-4 py-3.5 font-bold">Shoulder (in)</th>
                <th className="px-4 py-3.5 font-bold">Front Length (in)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100 text-primary-800 dark:divide-primary-700/60 dark:text-primary-200">
              {rows.map((row) => (
                <tr key={row.brandSize} className="hover:bg-primary-50/40 dark:hover:bg-primary-800/30">
                  <td className="px-4 py-3 font-bold">{row.brandSize}</td>
                  <td className="px-4 py-3 font-medium">{row.standardSize}</td>
                  <td className="px-4 py-3">{row.chest}</td>
                  <td className="px-4 py-3">{row.shoulder}</td>
                  <td className="px-4 py-3">{row.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
