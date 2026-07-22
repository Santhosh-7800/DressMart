import axios from 'axios';

export interface PincodeCheckResult {
  isServiceable: boolean;
  city?: string;
  state?: string;
  message: string;
}

interface PostOffice {
  District: string;
  State: string;
}

interface PostalApiResponse {
  Status: string;
  PostOffice: PostOffice[] | null;
}

const POSTAL_API_BASE = 'https://api.postalpincode.in/pincode';

/**
 * Delivery-pincode serviceability check against India's public postal API.
 * This is the one call in the app that hits a real external REST endpoint
 * rather than Supabase — everything else goes through services/* — so it's
 * the natural place to use axios instead of the Supabase client.
 */
export const pincodeService = {
  async check(pincode: string): Promise<PincodeCheckResult> {
    if (!/^\d{6}$/.test(pincode)) {
      return { isServiceable: false, message: 'Enter a valid 6-digit pincode.' };
    }

    try {
      const { data } = await axios.get<PostalApiResponse[]>(`${POSTAL_API_BASE}/${pincode}`, { timeout: 6000 });
      const result = data[0];
      const office = result?.PostOffice?.[0];

      if (result?.Status === 'Success' && office) {
        return { isServiceable: true, city: office.District, state: office.State, message: `Delivery available to ${office.District}, ${office.State}` };
      }
      return { isServiceable: false, message: 'We currently do not deliver to this pincode.' };
    } catch {
      return { isServiceable: false, message: "Couldn't verify this pincode right now. Please try again." };
    }
  },
};
