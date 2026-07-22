/** Original, fictional courier partners (no real-world logistics brands). */
export interface CourierPartner {
  name: string;
  supportPhone: string;
}

const COURIER_PARTNERS: CourierPartner[] = [
  { name: 'Zipline Express', supportPhone: '1800-120-3456' },
  { name: 'Metro Dash Logistics', supportPhone: '1800-121-7890' },
  { name: 'QuickHaul Couriers', supportPhone: '1800-122-4567' },
  { name: 'Skyline Cargo Services', supportPhone: '1800-123-8901' },
  { name: 'Swift Route Express', supportPhone: '1800-124-2345' },
];

export interface GeneratedCourierInfo {
  courierName: string;
  courierPhone: string;
  trackingNumber: string;
}

/** Assigns a courier partner and a tracking number for a newly placed order. */
export function generateCourierInfo(): GeneratedCourierInfo {
  const partner = COURIER_PARTNERS[Math.floor(Math.random() * COURIER_PARTNERS.length)];
  const prefix = partner.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const trackingNumber = `${prefix}${Math.floor(100000000 + Math.random() * 900000000)}IN`;
  return { courierName: partner.name, courierPhone: partner.supportPhone, trackingNumber };
}
