export interface FilterState {
  selectedDistrict: string;
  selectedTehsil: string;
  selectedUC: string;
  selectedComplaintType: string;
  selectedStatus: string;
  selectedPriority: string;
  selectedAssignee: string;
  dateRange: { from: Date | null; to: Date | null };
  search: string;
}
