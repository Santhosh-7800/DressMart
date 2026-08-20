import axios from 'axios';

export interface PincodeCheckResult {
  isServiceable: boolean;
  city?: string;
  state?: string;
  message: string;
}

export interface LocalitySuggestion {
  /** Post office / locality name, e.g. "Madhapur". */
  name: string;
  /** District, used as the City field value, e.g. "Hyderabad". */
  city: string;
  state: string;
  pincode: string;
  /** Display label for the dropdown, e.g. "Madhapur, Hyderabad, Telangana". */
  label: string;
}

interface PostOffice {
  Name: string;
  District: string;
  State: string;
  Pincode: string;
}

interface PostalApiResponse {
  Status: string;
  PostOffice: PostOffice[] | null;
}

const POSTAL_API_ROOT = 'https://api.postalpincode.in';

/** Telangana cities/towns for the City field's local, instant autocomplete. */
export const TELANGANA_CITIES = [
  'Hyderabad',
  'Secunderabad',
  'Warangal',
  'Nizamabad',
  'Karimnagar',
  'Khammam',
  'Ramagundam',
  'Mahbubnagar',
  'Nalgonda',
  'Adilabad',
  'Suryapet',
  'Miryalaguda',
  'Jagtial',
  'Mancherial',
  'Kothagudem',
  'Sangareddy',
  'Siddipet',
  'Wanaparthy',
  'Vikarabad',
  'Jangaon',
  'Bhongir',
  'Medak',
  'Nirmal',
  'Kamareddy',
  'Zaheerabad',
  'Bodhan',
  'Gadwal',
  'Sircilla',
];

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
      const { data } = await axios.get<PostalApiResponse[]>(`${POSTAL_API_ROOT}/pincode/${pincode}`, { timeout: 6000 });
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

  /** Local, instant Telangana city matches for a partial query (case-insensitive substring). */
  searchTelanganaCities(queryText: string): string[] {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];
    return TELANGANA_CITIES.filter((city) => city.toLowerCase().includes(q)).slice(0, 8);
  },

  /**
   * Locality/post-office search for the Address Line 1 autocomplete, restricted to Telangana.
   * Reuses the same public postal API as `check()`, querying by name instead of by pincode —
   * each match carries its own district + pincode, so a locality like Madhapur resolves to the
   * correct Hyderabad pincode for that area rather than a single hardcoded citywide value.
   */
  async searchLocalities(queryText: string): Promise<LocalitySuggestion[]> {
    const q = queryText.trim();
    if (q.length < 3) return [];
    try {
      const { data } = await axios.get<PostalApiResponse[]>(`${POSTAL_API_ROOT}/postoffice/${encodeURIComponent(q)}`, { timeout: 6000 });
      const offices = data[0]?.PostOffice ?? [];
      return offices
        .filter((office) => office.State?.toLowerCase() === 'telangana')
        .map((office) => ({
          name: office.Name,
          city: office.District,
          state: 'Telangana',
          pincode: office.Pincode,
          label: `${office.Name}, ${office.District}, Telangana`,
        }))
        .slice(0, 8);
    } catch {
      return [];
    }
  },

  /** Best-effort pincode for a bare city name (no specific locality chosen yet). */
  async lookupPincodeForCity(cityName: string): Promise<string | null> {
    const matches = await pincodeService.searchLocalities(cityName);
    return matches[0]?.pincode ?? null;
  },
};
