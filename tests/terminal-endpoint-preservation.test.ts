import { expect, test } from "bun:test"
import { doRoutesPreservePcbPortTerminals } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { HighDensityRoute } from "../types/high-density-types"

test("repair candidates preserve tagged PCB terminal position and layer", () => {
  const input: HighDensityRoute[] = [
    {
      connectionName: "net",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      route: [
        { x: 0, y: 0, z: 0, pcb_port_id: "pcb_port_a" },
        { x: 2, y: 0, z: 0, pcb_port_id: "pcb_port_b" },
      ],
      vias: [],
    },
  ]
  const clone = () => structuredClone(input)
  const changedLayer = clone()
  changedLayer[0]!.route[0]!.z = 1
  const changedPosition = clone()
  changedPosition[0]!.route.at(-1)!.x = 1.9
  const missingIdentity = clone()
  missingIdentity[0]!.route[0]!.pcb_port_id = undefined

  expect(doRoutesPreservePcbPortTerminals(input, clone())).toBe(true)
  expect(doRoutesPreservePcbPortTerminals(input, changedLayer)).toBe(false)
  expect(doRoutesPreservePcbPortTerminals(input, changedPosition)).toBe(false)
  expect(doRoutesPreservePcbPortTerminals(input, missingIdentity)).toBe(false)
})
