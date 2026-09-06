import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import { convertToCircuitJson } from "../lib/utils/convertToCircuitJson"
import {
  createAliasedPadFixture,
  getCompiledObstacles,
  getCompiledPrimitiveSet,
} from "./fixtures/obstacle-primitives"

test("deduplicates only equivalent primitive geometry layers and ownership", (): void => {
  const srj = createAliasedPadFixture()
  srj.obstacles.splice(1)
  const original = srj.obstacles[0]!
  const duplicate = structuredClone(original)
  duplicate.connectedTo.reverse()
  const otherLayer = { ...structuredClone(original), layers: ["bottom"] }
  const otherOwner = {
    ...structuredClone(original),
    circuitJsonMetadata: { pcb_smtpad_id: "pcb_smtpad_other" },
    connectedTo: ["pcb_smtpad_other", "signal"],
  }
  srj.obstacles.push(duplicate, otherLayer, otherOwner)
  const engine = new AutoroutingDrcEngine(srj)
  expect(getCompiledObstacles(engine)).toHaveLength(3)
  const ownership = getCompiledObstacles(engine).map((obstacle) => [
    obstacle.obstacleId,
    obstacle.layers,
    [...obstacle.connectedTo].sort(),
  ]).sort()
  expect(ownership).toEqual([
    ["pcb_smtpad_0", ["bottom"], [...original.connectedTo].sort()],
    ["pcb_smtpad_0", ["top"], [...original.connectedTo].sort()],
    ["pcb_smtpad_other", ["top"], ["pcb_smtpad_other", "signal"]],
  ])
  const pads = convertToCircuitJson(srj, []).filter(
    (element) => element.type === "pcb_smtpad",
  )
  expect(pads).toHaveLength(3)
  expect(new Set(pads.map((pad) => pad.pcb_smtpad_id)).size).toBe(3)
  expect(pads.find((pad) => pad.pcb_smtpad_id === "pcb_smtpad_other")).toBeDefined()
  const reversed = { ...srj, obstacles: [...srj.obstacles].reverse() }
  expect(getCompiledPrimitiveSet(new AutoroutingDrcEngine(reversed))).toEqual(
    getCompiledPrimitiveSet(engine),
  )
  expect(convertToCircuitJson(reversed, [])
    .filter((element) => element.type === "pcb_smtpad")
    .map((pad) => JSON.stringify(pad)).sort(),
  ).toEqual(pads.map((pad) => JSON.stringify(pad)).sort())
})
