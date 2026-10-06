export function branchFields(branch, { transfer = false, userForm = false } = {}) {
  const prefix = transfer ? "transfer_" : "";
  return {
    [`${prefix}branch_id`]: branch?.branch_id || "",
    [`${prefix}branch_name`]: branch?.branch_name || "",
    [transfer || userForm ? "transfer_location" : "location_city"]: branch?.city || "",
  };
}

export const clearedBranchFields = {
  branch_id: "", branch_name: "", location_city: "", transfer_location: "",
  transfer_branch_id: "", transfer_branch_name: "", transfer_date: "",
};
