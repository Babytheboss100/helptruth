import breedz from "./breedz";
import helptruth from "./helptruth";

export const TENANTS = {
  [breedz.id]: breedz,
  [helptruth.id]: helptruth,
};

export const DEFAULT_TENANT_ID = "breedz";

export { breedz, helptruth };
