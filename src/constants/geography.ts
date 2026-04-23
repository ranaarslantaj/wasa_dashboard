export const PROVINCES = [
  'Punjab',
  'Sindh',
  'KPK',
  'Balochistan',
  'Gilgit-Baltistan',
  'Azad Kashmir',
  'ICT',
] as const;

export type Province = (typeof PROVINCES)[number];

export const ACCESS_LEVELS = {
  PROVINCE: 'province',
  DIVISION: 'division',
  DISTRICT: 'district',
  TEHSIL: 'tehsil',
} as const;

export const PROVINCE_DIVISIONS: Record<string, string[]> = {
  Punjab: [
    'Lahore',
    'Gujranwala',
    'Faisalabad',
    'Rawalpindi',
    'Sargodha',
    'Multan',
    'Bahawalpur',
    'Dera Ghazi Khan',
    'Sahiwal',
  ],
  Sindh: [],
  KPK: [],
  Balochistan: [],
  'Gilgit-Baltistan': [],
  'Azad Kashmir': [],
  ICT: [],
};

export const DIVISION_DISTRICTS: Record<string, string[]> = {
  Lahore: ['Lahore', 'Kasur', 'Sheikhupura', 'Nankana Sahib'],
  Gujranwala: ['Gujranwala', 'Gujrat', 'Hafizabad', 'Mandi Bahauddin', 'Narowal', 'Sialkot'],
  Faisalabad: ['Faisalabad', 'Chiniot', 'Jhang', 'Toba Tek Singh'],
  Rawalpindi: ['Rawalpindi', 'Attock', 'Chakwal', 'Jhelum'],
  Sargodha: ['Sargodha', 'Bhakkar', 'Khushab', 'Mianwali'],
  Multan: ['Multan', 'Khanewal', 'Lodhran', 'Vehari'],
  Bahawalpur: ['Bahawalpur', 'Bahawalnagar', 'Rahim Yar Khan'],
  'Dera Ghazi Khan': ['Dera Ghazi Khan', 'Layyah', 'Muzaffargarh', 'Rajanpur'],
  Sahiwal: ['Sahiwal', 'Okara', 'Pakpattan'],
};

export const DISTRICT_TEHSILS: Record<string, string[]> = {
  Lahore: ['Lahore City', 'Lahore Cantonment', 'Model Town', 'Raiwind', 'Shalimar'],
  Kasur: ['Kasur', 'Chunian', 'Pattoki', 'Kot Radha Kishan'],
  Sheikhupura: ['Sheikhupura', 'Ferozewala', 'Muridke', 'Safdarabad', 'Sharaqpur'],
  'Nankana Sahib': ['Nankana Sahib', 'Shahkot', 'Sangla Hill'],
  Gujranwala: ['Gujranwala City', 'Gujranwala Saddar', 'Kamoke', 'Nowshera Virkan', 'Wazirabad'],
  Gujrat: ['Gujrat', 'Kharian', 'Sarai Alamgir'],
  Hafizabad: ['Hafizabad', 'Pindi Bhattian'],
  'Mandi Bahauddin': ['Mandi Bahauddin', 'Malakwal', 'Phalia'],
  Narowal: ['Narowal', 'Shakargarh', 'Zafarwal'],
  Sialkot: ['Sialkot', 'Daska', 'Pasrur', 'Sambrial'],
  Faisalabad: [
    'Faisalabad City',
    'Faisalabad Saddar',
    'Jaranwala',
    'Samundri',
    'Tandlianwala',
    'Chak Jhumra',
  ],
  Chiniot: ['Chiniot', 'Bhowana', 'Lalian'],
  Jhang: ['Jhang', 'Shorkot', '18-Hazari', 'Ahmadpur Sial'],
  'Toba Tek Singh': ['Toba Tek Singh', 'Gojra', 'Kamalia', 'Pir Mahal'],
  Rawalpindi: [
    'Rawalpindi',
    'Taxila',
    'Gujar Khan',
    'Kahuta',
    'Kallar Syedan',
    'Kotli Sattian',
    'Murree',
  ],
  Attock: ['Attock', 'Fateh Jang', 'Hassan Abdal', 'Hazro', 'Jand', 'Pindi Gheb'],
  Chakwal: ['Chakwal', 'Choa Saidan Shah', 'Kallar Kahar', 'Talagang', 'Lawa'],
  Jhelum: ['Jhelum', 'Dina', 'Pind Dadan Khan', 'Sohawa'],
  Sargodha: [
    'Sargodha',
    'Bhalwal',
    'Kot Momin',
    'Sahiwal (Sargodha)',
    'Shahpur',
    'Silanwali',
    'Sillanwali',
  ],
  Bhakkar: ['Bhakkar', 'Darya Khan', 'Kaloor Kot', 'Mankera'],
  Khushab: ['Khushab', 'Noorpur Thal', 'Quaidabad', 'Naushera'],
  Mianwali: ['Mianwali', 'Isakhel', 'Piplan'],
  Multan: ['Multan City', 'Multan Saddar', 'Shujabad', 'Jalalpur Pirwala'],
  Khanewal: ['Khanewal', 'Kabirwala', 'Mian Channu', 'Jahanian'],
  Lodhran: ['Lodhran', 'Dunyapur', 'Kahror Pacca'],
  Vehari: ['Vehari', 'Burewala', 'Mailsi'],
  Bahawalpur: [
    'Bahawalpur City',
    'Bahawalpur Saddar',
    'Ahmadpur East',
    'Hasilpur',
    'Khairpur Tamewali',
    'Yazman',
  ],
  Bahawalnagar: ['Bahawalnagar', 'Chishtian', 'Fort Abbas', 'Haroonabad', 'Minchinabad'],
  'Rahim Yar Khan': ['Rahim Yar Khan', 'Khanpur', 'Liaquatpur', 'Sadiqabad'],
  'Dera Ghazi Khan': ['Dera Ghazi Khan', 'Taunsa', 'Kot Chutta'],
  Layyah: ['Layyah', 'Choubara', 'Karor Lal Esan'],
  Muzaffargarh: ['Muzaffargarh', 'Alipur', 'Jatoi', 'Kot Addu'],
  Rajanpur: ['Rajanpur', 'Jampur', 'Rojhan'],
  Sahiwal: ['Sahiwal', 'Chichawatni'],
  Okara: ['Okara', 'Depalpur', 'Renala Khurd'],
  Pakpattan: ['Pakpattan', 'Arifwala'],
};

export const getDivisionsForProvince = (province: string | null | undefined): string[] =>
  province ? (PROVINCE_DIVISIONS[province] ?? []) : [];

export const getDistrictsForDivision = (division: string | null | undefined): string[] =>
  division ? (DIVISION_DISTRICTS[division] ?? []) : [];

export const getTehsilsForDistrict = (district: string | null | undefined): string[] =>
  district ? (DISTRICT_TEHSILS[district] ?? []) : [];

export const getAllDistrictsForProvince = (province: string | null | undefined): string[] => {
  const divisions = getDivisionsForProvince(province);
  return divisions.flatMap((d) => getDistrictsForDivision(d));
};
