export interface UnionCouncil {
  id: string;
  name: string;
  district: string;
  tehsil: string;
  province: string;
  type?: 'UC' | 'MC';
}
