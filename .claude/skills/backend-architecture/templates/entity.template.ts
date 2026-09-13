// domain/entity/{feature-name}.entity.ts
// Only add an entity class when the feature carries behavior beyond plain data
// (validation rules, derived fields, state transitions). Otherwise use the
// I{Feature} interface from @holista/core/interfaces directly.
import { I{Feature} } from "@holista/core/interfaces";

export interface I{Feature}Entity extends I{Feature} {
  // declare behavior methods here, e.g. isEligibleForX(): boolean;
}

export class {Feature} implements I{Feature}Entity {
  id: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: I{Feature}) {
    this.id = data.id;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // add domain behavior methods here
}
