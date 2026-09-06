import { expect, test } from "bun:test"
import {
  applyDrcErrorForces,
  cloneRoutes,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { createSharedViaPadFixture } from "./fixtures/shared-via-pad"

test("rejects malformed authoritative via pad centers without guessing a target", (): void => {
  const { srj, hdRoutes } = createSharedViaPadFixture()
  for (const invalid of [
    undefined,
    null,
    "0,0",
    {},
    { x: 0 },
    { x: "0", y: 0 },
    { x: Number.NaN, y: 0 },
    { x: 0, y: Number.POSITIVE_INFINITY },
  ]) {
    const candidate = cloneRoutes(hdRoutes)
    expect((): void => {
      applyDrcErrorForces(
        srj,
        candidate,
        [{
          type: "pcb_pad_pad_clearance_error",
          pcb_trace_id: "signal_mst0_0",
          pcb_via_ids: ["via_0"],
          pcb_pad_ids: ["via_0", "pcb_smtpad_foreign"],
          center: { x: 0.22, y: 0 },
          pcb_obstacle_center: invalid,
        }],
        new Map([["signal_mst0_0", 0]]),
        1,
      )
    }).toThrow("pcb_obstacle_center must contain finite x and y coordinates")
    expect(candidate).toEqual(hdRoutes)
  }
})
